import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { headers } from 'next/headers'
import crypto from 'crypto'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

export async function POST(request: NextRequest) {
  const supabase = createClient(supabaseUrl, supabaseServiceKey)
  let webhookEventId: string | null = null

  try {
    const headersList = await headers()
    const topic = headersList.get('x-shopify-topic')
    const hmac = headersList.get('x-shopify-hmac-sha256')
    const shop = headersList.get('x-shopify-shop-domain')

    const body = await request.text()

    // Verify HMAC (optional but recommended for production)
    const secret = process.env.SHOPIFY_WEBHOOK_SECRET
    if (secret && hmac) {
      const hash = crypto
        .createHmac('sha256', secret)
        .update(body, 'utf8')
        .digest('base64')

      if (hash !== hmac) {
        console.error('HMAC verification failed')
        return NextResponse.json({ error: 'Invalid HMAC' }, { status: 401 })
      }
    }

    const payload = JSON.parse(body)
    const externalEventId = payload.id?.toString()

    // Check for duplicate webhook (idempotency)
    const { data: existingEvent } = await supabase
      .from('webhook_events')
      .select('id, processing_status, retry_count')
      .eq('provider', 'shopify')
      .eq('external_event_id', externalEventId)
      .single()

    if (existingEvent) {
      // Duplicate webhook detected
      if (existingEvent.processing_status === 'completed') {
        // Already processed successfully - return 200 to acknowledge
        return NextResponse.json({ received: true, status: 'duplicate_processed' })
      }
      // If failed or pending, we'll reprocess (manual retry scenario)
      webhookEventId = existingEvent.id
    }

    // Create or update webhook event
    if (!webhookEventId) {
      const { data: webhookEvent, error: insertError } = await supabase
        .from('webhook_events')
        .insert({
          provider: 'shopify',
          event_type: topic || 'unknown',
          external_event_id: externalEventId,
          payload: payload,
          processing_status: 'pending',
        })
        .select()
        .single()

      if (insertError) {
        console.error('Failed to create webhook event:', insertError)
        return NextResponse.json(
          { error: 'Failed to log webhook event' },
          { status: 500 }
        )
      }

      webhookEventId = webhookEvent.id
    }

    // Mark as processing
    await supabase
      .from('webhook_events')
      .update({
        processing_status: 'processing',
        retry_count: existingEvent ? (existingEvent.retry_count || 0) + 1 : 0,
        last_retry_at: existingEvent ? new Date().toISOString() : null,
      })
      .eq('id', webhookEventId)

    // Process based on topic
    if (topic === 'orders/create' || topic === 'orders/updated') {
      await processOrder(supabase, payload, webhookEventId)
    } else if (topic === 'fulfillments/create' || topic === 'orders/fulfilled') {
      await processFulfillment(supabase, payload, webhookEventId)
    } else {
      // Unknown topic - mark as skipped
      await supabase
        .from('webhook_events')
        .update({
          processing_status: 'skipped',
          processed_at: new Date().toISOString(),
        })
        .eq('id', webhookEventId)
    }

    return NextResponse.json({ received: true })
  } catch (error) {
    console.error('Webhook error:', error)

    // Mark webhook as failed
    if (webhookEventId) {
      await supabase
        .from('webhook_events')
        .update({
          processing_status: 'failed',
          processing_error: error instanceof Error ? error.message : String(error),
        })
        .eq('id', webhookEventId)
    }

    return NextResponse.json(
      { error: 'Webhook processing failed' },
      { status: 500 }
    )
  }
}

async function processOrder(supabase: any, order: any, webhookEventId: string) {
  // Check if this is a custom order based on detection rules
  const isCustomOrder = detectCustomOrder(order)

  if (!isCustomOrder) {
    // Mark webhook as completed (non-custom order, no action needed)
    await supabase
      .from('webhook_events')
      .update({
        processing_status: 'completed',
        processed_at: new Date().toISOString(),
        processing_error: 'Not a custom order - no work item created',
      })
      .eq('id', webhookEventId)
    return
  }

  // Check if work item already exists (idempotency)
  const { data: existingWorkItem } = await supabase
    .from('work_items')
    .select('id')
    .eq('shopify_order_id', order.id.toString())
    .single()

  if (existingWorkItem) {
    // Update existing work item with latest Shopify data
    await supabase
      .from('work_items')
      .update({
        shopify_financial_status: order.financial_status,
        shopify_fulfillment_status: order.fulfillment_status,
      })
      .eq('id', existingWorkItem.id)

    // Mark webhook as completed
    await supabase
      .from('webhook_events')
      .update({
        processing_status: 'completed',
        processed_at: new Date().toISOString(),
      })
      .eq('id', webhookEventId)

    return
  }

  // Extract design URLs from line items (Customify)
  let designPreviewUrl = null
  let designDownloadUrl = null
  let quantity = 0
  let gripColor = null

  for (const item of order.line_items || []) {
    if (item.properties) {
      const props = Array.isArray(item.properties) ? item.properties : []
      for (const prop of props) {
        if (prop.name === 'design_preview' || prop.name === '_design_preview_url') {
          designPreviewUrl = prop.value
        }
        if (prop.name === 'design_download' || prop.name === '_design_download_url') {
          designDownloadUrl = prop.value
        }
        if (prop.name === 'grip_color' || prop.name === 'Grip Color') {
          gripColor = prop.value
        }
      }
    }
    quantity += item.quantity
  }

  // Create new work item
  const { error: insertError } = await supabase.from('work_items').insert({
    type: 'customify_order',
    source: 'shopify',
    status: 'needs_design_review',
    shopify_order_id: order.id.toString(),
    shopify_order_number: order.name,
    shopify_financial_status: order.financial_status,
    shopify_fulfillment_status: order.fulfillment_status,
    customer_name: order.customer ? `${order.customer.first_name || ''} ${order.customer.last_name || ''}`.trim() : null,
    customer_email: order.customer?.email,
    quantity,
    grip_color: gripColor,
    design_preview_url: designPreviewUrl,
    design_download_url: designDownloadUrl,
    reason_included: {
      detected_via: 'shopify_webhook',
      order_tags: order.tags,
      has_customify_properties: !!designPreviewUrl || !!designDownloadUrl,
    },
  })

  if (insertError) {
    throw new Error(`Failed to create work item: ${insertError.message}`)
  }

  // Mark webhook as completed
  await supabase
    .from('webhook_events')
    .update({
      processing_status: 'completed',
      processed_at: new Date().toISOString(),
    })
    .eq('id', webhookEventId)
}

async function processFulfillment(supabase: any, fulfillment: any, webhookEventId: string) {
  const orderId = fulfillment.order_id?.toString()

  if (!orderId) {
    await supabase
      .from('webhook_events')
      .update({
        processing_status: 'failed',
        processing_error: 'Missing order_id in fulfillment payload',
      })
      .eq('id', webhookEventId)
    return
  }

  // Update work item status to shipped
  const { error: updateError } = await supabase
    .from('work_items')
    .update({
      status: 'shipped',
      shopify_fulfillment_status: 'fulfilled',
    })
    .eq('shopify_order_id', orderId)

  if (updateError) {
    throw new Error(`Failed to update work item: ${updateError.message}`)
  }

  // Mark webhook as completed
  await supabase
    .from('webhook_events')
    .update({
      processing_status: 'completed',
      processed_at: new Date().toISOString(),
    })
    .eq('id', webhookEventId)
}

function detectCustomOrder(order: any): boolean {
  // Check line item properties for Customify markers
  for (const item of order.line_items || []) {
    if (item.properties) {
      const props = Array.isArray(item.properties) ? item.properties : []
      for (const prop of props) {
        if (
          prop.name.toLowerCase().includes('design') ||
          prop.name.toLowerCase().includes('customify')
        ) {
          return true
        }
      }
    }

    // Check product title
    if (
      item.title?.toLowerCase().includes('custom') ||
      item.title?.toLowerCase().includes('customify')
    ) {
      return true
    }
  }

  // Check order tags
  const tags = order.tags?.toLowerCase() || ''
  if (tags.includes('custom') || tags.includes('customify')) {
    return true
  }

  return false
}
