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

    // Should never be null at this point, but TypeScript doesn't know that
    if (!webhookEventId) {
      return NextResponse.json({ error: 'Failed to create webhook event' }, { status: 500 })
    }

    // Mark as processing
    await supabase
      .from('webhook_events')
      .update({
        processing_status: 'processing',
        retry_count: existingEvent ? (existingEvent.retry_count || 0) + 1 : 0,
        last_retry_at: existingEvent ? new Date().toISOString() : null,
      })
      .eq('id', webhookEventId!)

    // Process based on topic
    if (topic === 'orders/create' || topic === 'orders/updated') {
      await processOrder(supabase, payload, webhookEventId!)
    } else if (topic === 'fulfillments/create' || topic === 'orders/fulfilled') {
      await processFulfillment(supabase, payload, webhookEventId!)
    } else {
      // Unknown topic - mark as skipped
      await supabase
        .from('webhook_events')
        .update({
          processing_status: 'skipped',
          processed_at: new Date().toISOString(),
        })
        .eq('id', webhookEventId!)
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
  const orderType = detectOrderType(order)

  if (!orderType) {
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

  const customerEmail = order.customer?.email
  const customerName = order.customer ? `${order.customer.first_name || ''} ${order.customer.last_name || ''}`.trim() : null

  // For Custom Design Service, try to find existing work item by email
  let existingWorkItem = null
  if (orderType === 'custom_design_service') {
    const { data: foundWorkItem } = await supabase
      .from('work_items')
      .select('id, status')
      .eq('customer_email', customerEmail)
      .eq('type', 'assisted_project')
      .in('status', ['new_inquiry', 'design_fee_sent', 'info_sent'])
      .is('closed_at', null)
      .order('created_at', { ascending: false })
      .limit(1)
      .single()

    existingWorkItem = foundWorkItem
  } else {
    // For Customify orders, check by Shopify order ID
    const { data: foundWorkItem } = await supabase
      .from('work_items')
      .select('id, status')
      .eq('shopify_order_id', order.id.toString())
      .single()

    existingWorkItem = foundWorkItem
  }

  if (existingWorkItem) {
    // Update existing work item
    const updateData: any = {
      shopify_order_id: order.id.toString(),
      shopify_order_number: order.name,
      shopify_financial_status: order.financial_status,
      shopify_fulfillment_status: order.fulfillment_status,
      customer_name: customerName,
    }

    // If it's a Custom Design Service order, update status
    if (orderType === 'custom_design_service') {
      updateData.status = 'design_fee_paid'
    }

    await supabase
      .from('work_items')
      .update(updateData)
      .eq('id', existingWorkItem.id)

    // Create status event if status changed
    if (orderType === 'custom_design_service' && existingWorkItem.status !== 'design_fee_paid') {
      await supabase.from('work_item_status_events').insert({
        work_item_id: existingWorkItem.id,
        from_status: existingWorkItem.status,
        to_status: 'design_fee_paid',
        changed_by_user_id: null,
        note: `Design fee paid via Shopify order #${order.name}`,
      })
    }

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

  // Extract data from line items
  let designPreviewUrl = null
  let designDownloadUrl = null
  let quantity = 0
  let gripColor = null
  const customifyFiles: Array<{ kind: string; url: string; filename: string }> = []

  for (const item of order.line_items || []) {
    if (item.properties) {
      const props = Array.isArray(item.properties) ? item.properties : []
      for (const prop of props) {
        const propName = prop.name?.toLowerCase() || ''
        const propValue = prop.value

        // Extract URLs
        if (propName === 'design_preview' || propName === '_design_preview_url' || propName === 'preview') {
          designPreviewUrl = propValue
        }
        if (propName === 'design_download' || propName === '_design_download_url') {
          designDownloadUrl = propValue
        }
        if (propName === 'grip_color' || propName === 'grip color') {
          gripColor = propValue
        }

        // Collect Customify file URLs
        if (propName.includes('final design') && propValue?.includes('http')) {
          customifyFiles.push({ kind: 'design', url: propValue, filename: `final-design-${propName}` })
        } else if (propName.includes('design ') && !propName.includes('final') && propValue?.includes('http')) {
          customifyFiles.push({ kind: 'preview', url: propValue, filename: `design-${propName}` })
        } else if (propName.includes('cst-original-image') && propValue?.includes('http')) {
          customifyFiles.push({ kind: 'other', url: propValue, filename: `original-${propName}` })
        } else if (propName.includes('preview') && propValue?.includes('http')) {
          customifyFiles.push({ kind: 'preview', url: propValue, filename: `preview-${propName}` })
        }
      }
    }
    quantity += item.quantity
  }

  // Determine work item type and status
  const workItemType = orderType === 'custom_design_service' ? 'assisted_project' : 'customify_order'
  const workItemStatus = orderType === 'custom_design_service' ? 'design_fee_paid' : 'needs_design_review'

  // Create new work item
  const { data: newWorkItem, error: insertError } = await supabase
    .from('work_items')
    .insert({
      type: workItemType,
      source: 'shopify',
      status: workItemStatus,
      shopify_order_id: order.id.toString(),
      shopify_order_number: order.name,
      shopify_financial_status: order.financial_status,
      shopify_fulfillment_status: order.fulfillment_status,
      customer_name: customerName,
      customer_email: customerEmail,
      quantity,
      grip_color: gripColor,
      design_preview_url: designPreviewUrl,
      design_download_url: designDownloadUrl,
      reason_included: {
        detected_via: 'shopify_webhook',
        order_type: orderType,
        order_tags: order.tags,
        has_customify_properties: !!designPreviewUrl || !!designDownloadUrl,
      },
    })
    .select()
    .single()

  if (insertError) {
    throw new Error(`Failed to create work item: ${insertError.message}`)
  }

  // Create file records for Customify files
  if (customifyFiles.length > 0 && newWorkItem) {
    const fileRecords = customifyFiles.map((file, index) => ({
      work_item_id: newWorkItem.id,
      kind: file.kind,
      version: index + 1,
      original_filename: file.filename,
      normalized_filename: file.filename,
      storage_bucket: 'customify',
      storage_path: file.url,
      mime_type: 'image/png',
      size_bytes: null,
      uploaded_by_user_id: null,
      note: 'Imported from Customify',
    }))

    await supabase.from('files').insert(fileRecords)
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

function detectOrderType(order: any): 'customify_order' | 'custom_design_service' | null {
  // Check for Custom Design Service product first (higher priority)
  for (const item of order.line_items || []) {
    const title = item.title?.toLowerCase() || ''
    if (
      title.includes('professional custom fan design service') ||
      title.includes('custom fan design service') ||
      title.includes('design service & credit')
    ) {
      return 'custom_design_service'
    }
  }

  // Check line item properties for Customify markers
  for (const item of order.line_items || []) {
    if (item.properties) {
      const props = Array.isArray(item.properties) ? item.properties : []
      for (const prop of props) {
        const propName = prop.name?.toLowerCase() || ''
        if (propName.includes('customify')) {
          return 'customify_order'
        }
      }
    }

    // Check product title for Customify
    const title = item.title?.toLowerCase() || ''
    if (title.includes('customify')) {
      return 'customify_order'
    }
  }

  // Check order tags
  const tags = order.tags?.toLowerCase() || ''
  if (tags.includes('customify')) {
    return 'customify_order'
  }
  if (tags.includes('custom design')) {
    return 'custom_design_service'
  }

  return null
}
