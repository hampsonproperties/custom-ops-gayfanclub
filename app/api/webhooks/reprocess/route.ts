import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

export async function POST(request: NextRequest) {
  try {
    const { webhookId } = await request.json()

    if (!webhookId) {
      return NextResponse.json({ error: 'webhookId required' }, { status: 400 })
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // Fetch the webhook event
    const { data: webhookEvent, error: fetchError } = await supabase
      .from('webhook_events')
      .select('*')
      .eq('id', webhookId)
      .single()

    if (fetchError || !webhookEvent) {
      return NextResponse.json({ error: 'Webhook event not found' }, { status: 404 })
    }

    // Check retry limit
    const maxRetries = 3
    if (webhookEvent.retry_count >= maxRetries) {
      return NextResponse.json(
        { error: `Maximum retry limit (${maxRetries}) exceeded` },
        { status: 400 }
      )
    }

    // Check if already completed
    if (webhookEvent.processing_status === 'completed') {
      return NextResponse.json(
        { error: 'Webhook already processed successfully' },
        { status: 400 }
      )
    }

    // Mark as processing
    await supabase
      .from('webhook_events')
      .update({
        processing_status: 'processing',
        retry_count: webhookEvent.retry_count + 1,
        last_retry_at: new Date().toISOString(),
        processing_error: null,
      })
      .eq('id', webhookId)

    // Reprocess based on event type
    const payload = webhookEvent.payload
    const eventType = webhookEvent.event_type

    try {
      if (eventType === 'orders/create' || eventType === 'orders/updated') {
        await processOrder(supabase, payload, webhookId)
      } else if (eventType === 'fulfillments/create' || eventType === 'orders/fulfilled') {
        await processFulfillment(supabase, payload, webhookId)
      } else {
        // Unknown event type
        await supabase
          .from('webhook_events')
          .update({
            processing_status: 'skipped',
            processed_at: new Date().toISOString(),
          })
          .eq('id', webhookId)
      }

      return NextResponse.json({ success: true })
    } catch (processingError) {
      // Mark as failed again
      await supabase
        .from('webhook_events')
        .update({
          processing_status: 'failed',
          processing_error:
            processingError instanceof Error
              ? processingError.message
              : String(processingError),
        })
        .eq('id', webhookId)

      throw processingError
    }
  } catch (error) {
    console.error('Reprocess error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Reprocessing failed' },
      { status: 500 }
    )
  }
}

// Copy of processOrder from main webhook handler
async function processOrder(supabase: any, order: any, webhookEventId: string) {
  const isCustomOrder = detectCustomOrder(order)

  if (!isCustomOrder) {
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

  const { data: existingWorkItem } = await supabase
    .from('work_items')
    .select('id')
    .eq('shopify_order_id', order.id.toString())
    .single()

  if (existingWorkItem) {
    await supabase
      .from('work_items')
      .update({
        shopify_financial_status: order.financial_status,
        shopify_fulfillment_status: order.fulfillment_status,
      })
      .eq('id', existingWorkItem.id)

    await supabase
      .from('webhook_events')
      .update({
        processing_status: 'completed',
        processed_at: new Date().toISOString(),
      })
      .eq('id', webhookEventId)

    return
  }

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

  const { error: insertError } = await supabase.from('work_items').insert({
    type: 'customify_order',
    source: 'shopify',
    status: 'needs_design_review',
    shopify_order_id: order.id.toString(),
    shopify_order_number: order.name,
    shopify_financial_status: order.financial_status,
    shopify_fulfillment_status: order.fulfillment_status,
    customer_name: order.customer
      ? `${order.customer.first_name || ''} ${order.customer.last_name || ''}`.trim()
      : null,
    customer_email: order.customer?.email,
    quantity,
    grip_color: gripColor,
    design_preview_url: designPreviewUrl,
    design_download_url: designDownloadUrl,
    reason_included: {
      detected_via: 'shopify_webhook_reprocess',
      order_tags: order.tags,
      has_customify_properties: !!designPreviewUrl || !!designDownloadUrl,
    },
  })

  if (insertError) {
    throw new Error(`Failed to create work item: ${insertError.message}`)
  }

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

  await supabase
    .from('webhook_events')
    .update({
      processing_status: 'completed',
      processed_at: new Date().toISOString(),
    })
    .eq('id', webhookEventId)
}

function detectCustomOrder(order: any): boolean {
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

    if (
      item.title?.toLowerCase().includes('custom') ||
      item.title?.toLowerCase().includes('customify')
    ) {
      return true
    }
  }

  const tags = order.tags?.toLowerCase() || ''
  if (tags.includes('custom') || tags.includes('customify')) {
    return true
  }

  return false
}
