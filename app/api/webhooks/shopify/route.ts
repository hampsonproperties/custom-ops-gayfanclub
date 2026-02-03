import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { headers } from 'next/headers'
import crypto from 'crypto'
import { detectOrderType } from '@/lib/shopify/detect-order-type'

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

/**
 * Downloads a file from an external URL and uploads it to Supabase Storage
 * @returns { path: string, sizeBytes: number } or null if download fails
 */
async function downloadAndStoreFile(
  supabase: any,
  externalUrl: string,
  workItemId: string,
  filename: string
): Promise<{ path: string; sizeBytes: number } | null> {
  try {
    // Ensure URL has protocol
    let url = externalUrl
    if (url.startsWith('//')) {
      url = `https:${url}`
    }

    console.log(`Downloading file from: ${url}`)

    // Download file from external URL
    const response = await fetch(url)
    if (!response.ok) {
      console.error(`Failed to download file: ${response.status} ${response.statusText}`)
      return null
    }

    const arrayBuffer = await response.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)
    const sizeBytes = buffer.length

    // Determine file extension from URL or content-type
    let extension = 'png'
    const urlExtension = url.split('.').pop()?.toLowerCase()
    if (urlExtension && ['png', 'jpg', 'jpeg', 'gif', 'webp', 'pdf'].includes(urlExtension)) {
      extension = urlExtension
    }

    // Generate storage path: work-items/{id}/{filename}.{ext}
    const storagePath = `work-items/${workItemId}/${filename}.${extension}`

    // Upload to Supabase Storage
    const { error: uploadError } = await supabase.storage
      .from('custom-ops-files')
      .upload(storagePath, buffer, {
        contentType: response.headers.get('content-type') || 'image/png',
        upsert: true,
      })

    if (uploadError) {
      console.error(`Failed to upload file to Supabase Storage:`, uploadError)
      return null
    }

    console.log(`Successfully stored file at: ${storagePath} (${sizeBytes} bytes)`)
    return { path: storagePath, sizeBytes }
  } catch (error) {
    console.error(`Error downloading/storing file:`, error)
    return null
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

  // Try to find existing work item
  let existingWorkItem = null

  if (orderType === 'custom_design_service') {
    // Link design fee orders to existing inquiries
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
  } else if (orderType === 'custom_bulk_order' && customerEmail) {
    // Link bulk/invoice orders to existing assisted projects awaiting payment
    const { data: foundWorkItem } = await supabase
      .from('work_items')
      .select('id, status, quantity, grip_color')
      .eq('customer_email', customerEmail)
      .eq('type', 'assisted_project')
      .in('status', ['design_fee_paid', 'in_design', 'proof_sent', 'awaiting_approval', 'invoice_sent'])
      .is('closed_at', null)
      .order('created_at', { ascending: false })
      .limit(1)
      .single()

    existingWorkItem = foundWorkItem
  } else {
    // For other orders, check by Shopify order ID (check both production and design fee order IDs)
    const orderId = order.id.toString()
    const { data: foundWorkItem } = await supabase
      .from('work_items')
      .select('id, status')
      .or(`shopify_order_id.eq.${orderId},design_fee_order_id.eq.${orderId}`)
      .maybeSingle()

    existingWorkItem = foundWorkItem
  }

  if (existingWorkItem) {
    // Update existing work item
    const updateData: any = {
      shopify_financial_status: order.financial_status,
      shopify_fulfillment_status: order.fulfillment_status,
      customer_name: customerName,
    }

    // For design fee orders, update design_fee_order fields
    if (orderType === 'custom_design_service') {
      updateData.design_fee_order_id = order.id.toString()
      updateData.design_fee_order_number = order.name
      updateData.status = order.financial_status === 'paid' ? 'design_fee_paid' : 'design_fee_sent'
    } else {
      // For production/bulk orders, update main shopify_order fields
      updateData.shopify_order_id = order.id.toString()
      updateData.shopify_order_number = order.name
    }

    // Extract quantity and grip color for bulk orders
    if (orderType === 'custom_bulk_order') {
      let quantity = 0
      let gripColor = null

      for (const item of order.line_items || []) {
        // Check if this line item is custom work (not standard inventory)
        const title = item.title?.toLowerCase() || ''
        const hasCustomifyProps = item.properties && Array.isArray(item.properties) &&
          item.properties.some((prop: any) => prop.name?.toLowerCase().includes('customify'))

        const isCustomItem = hasCustomifyProps ||
          title.includes('customify') ||
          title.includes('custom') ||
          title.includes('bulk')

        // Only process custom items, skip standard inventory
        if (!isCustomItem) {
          continue
        }

        // Extract quantity from product title first
        // Matches formats like: "(230 units/$12 unit)" or "(200 fans at $10/fan)"
        const match = item.title?.match(/\((\d+)\s+(?:units?|fans?)/i)
        if (match) {
          quantity += parseInt(match[1], 10)
        } else {
          quantity += item.quantity
        }

        if (item.properties) {
          const props = Array.isArray(item.properties) ? item.properties : []
          for (const prop of props) {
            const propName = prop.name?.toLowerCase() || ''
            if (propName === 'grip_color' || propName === 'grip color') {
              gripColor = prop.value
            }
          }
        }
      }

      updateData.quantity = quantity || existingWorkItem.quantity
      updateData.grip_color = gripColor || existingWorkItem.grip_color
      updateData.status = order.financial_status === 'paid' ? 'paid_ready_for_batch' : 'invoice_sent'
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

    if (orderType === 'custom_bulk_order' && existingWorkItem.status !== 'paid_ready_for_batch') {
      await supabase.from('work_item_status_events').insert({
        work_item_id: existingWorkItem.id,
        from_status: existingWorkItem.status,
        to_status: updateData.status,
        changed_by_user_id: null,
        note: `Production order ${order.financial_status === 'paid' ? 'paid' : 'received'} via Shopify order #${order.name}`,
      })
    }

    // Auto-link recent emails from this customer
    if (customerEmail) {
      const orderDate = new Date(order.created_at)
      const lookbackDate = new Date(orderDate)
      lookbackDate.setDate(lookbackDate.getDate() - 30)

      // For design fee orders, include emails up to NOW
      const upperBoundDate = orderType === 'custom_design_service'
        ? new Date()
        : orderDate

      const { data: recentEmails } = await supabase
        .from('communications')
        .select('id')
        .eq('from_email', customerEmail)
        .is('work_item_id', null)
        .gte('received_at', lookbackDate.toISOString())
        .lte('received_at', upperBoundDate.toISOString())

      if (recentEmails && recentEmails.length > 0) {
        await supabase
          .from('communications')
          .update({
            work_item_id: existingWorkItem.id,
            triage_status: 'attached'
          })
          .in('id', recentEmails.map((e: any) => e.id))

        console.log(`Auto-linked ${recentEmails.length} emails to work item ${existingWorkItem.id}`)
      }
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
    // Check if this line item is custom work (not standard inventory)
    const title = item.title?.toLowerCase() || ''
    const hasCustomifyProps = item.properties && Array.isArray(item.properties) &&
      item.properties.some((prop: any) => prop.name?.toLowerCase().includes('customify'))

    const isCustomItem = hasCustomifyProps ||
      title.includes('customify') ||
      title.includes('custom') ||
      title.includes('bulk')

    // Only process custom items, skip standard inventory
    if (!isCustomItem) {
      continue
    }

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

    // Extract quantity for custom items
    // Try to extract from product title first
    // Matches formats like: "(230 units/$12 unit)" or "(200 fans at $10/fan)"
    const match = item.title?.match(/\((\d+)\s+(?:units?|fans?)/i)
    if (match) {
      quantity += parseInt(match[1], 10)
    } else {
      // Use line item quantity if not in title
      quantity += item.quantity
    }
  }

  // Determine work item type and status
  const workItemType = (orderType === 'custom_design_service' || orderType === 'custom_bulk_order') ? 'assisted_project' : 'customify_order'

  // Determine status based on order type AND payment status
  let workItemStatus: string
  if (orderType === 'custom_design_service') {
    // Design fee order - check if actually paid
    workItemStatus = order.financial_status === 'paid' ? 'design_fee_paid' : 'design_fee_sent'
  } else if (orderType === 'custom_bulk_order') {
    // Production order - check if actually paid
    workItemStatus = order.financial_status === 'paid' ? 'paid_ready_for_batch' : 'invoice_sent'
  } else {
    // Customify order
    workItemStatus = 'needs_design_review'
  }

  // For design fee orders, store in design_fee_order_id. For others, use shopify_order_id
  const insertData: any = {
    type: workItemType,
    source: 'shopify',
    status: workItemStatus,
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
  }

  if (orderType === 'custom_design_service') {
    // Design fee order - store separately
    insertData.design_fee_order_id = order.id.toString()
    insertData.design_fee_order_number = order.name
  } else {
    // Production/Customify order - use main fields
    insertData.shopify_order_id = order.id.toString()
    insertData.shopify_order_number = order.name
  }

  // Check if this is a Shopify-first order (no prior email contact)
  // Only applicable for customify orders
  if (workItemType === 'customify_order' && customerEmail) {
    const { data: existingCommunications } = await supabase
      .from('communications')
      .select('id')
      .ilike('from_email', customerEmail)
      .limit(1)

    // No prior email communications = needs initial contact
    insertData.requires_initial_contact = !existingCommunications || existingCommunications.length === 0
  }

  // Create new work item
  const { data: newWorkItem, error: insertError } = await supabase
    .from('work_items')
    .insert(insertData)
    .select()
    .single()

  if (insertError) {
    throw new Error(`Failed to create work item: ${insertError.message}`)
  }

  // Calculate initial follow-up date
  if (newWorkItem) {
    try {
      const { data: nextFollowUp } = await supabase
        .rpc('calculate_next_follow_up', { work_item_id: newWorkItem.id })

      if (nextFollowUp !== undefined) {
        await supabase
          .from('work_items')
          .update({ next_follow_up_at: nextFollowUp })
          .eq('id', newWorkItem.id)
      }
    } catch (followUpError) {
      console.error('[Shopify Webhook] Error calculating follow-up:', followUpError)
    }
  }

  // Create file records for Customify files - download and store in Supabase
  if (customifyFiles.length > 0 && newWorkItem) {
    const fileRecords = []

    for (let index = 0; index < customifyFiles.length; index++) {
      const file = customifyFiles[index]

      // Download file from Customify and upload to our Supabase Storage
      const storedFile = await downloadAndStoreFile(
        supabase,
        file.url,
        newWorkItem.id,
        file.filename
      )

      if (storedFile) {
        // Successfully downloaded and stored - use our storage
        fileRecords.push({
          work_item_id: newWorkItem.id,
          kind: file.kind,
          version: index + 1,
          original_filename: file.filename,
          normalized_filename: file.filename,
          storage_bucket: 'custom-ops-files',
          storage_path: storedFile.path,
          external_url: file.url, // Preserve original Customify URL
          mime_type: 'image/png',
          size_bytes: storedFile.sizeBytes,
          uploaded_by_user_id: null,
          note: 'Imported from Customify and stored in Supabase',
        })
      } else {
        // Download failed - fall back to storing external URL only
        console.warn(`Failed to download ${file.filename}, storing external URL as fallback`)
        fileRecords.push({
          work_item_id: newWorkItem.id,
          kind: file.kind,
          version: index + 1,
          original_filename: file.filename,
          normalized_filename: file.filename,
          storage_bucket: 'customify',
          storage_path: file.url,
          external_url: file.url,
          mime_type: 'image/png',
          size_bytes: null,
          uploaded_by_user_id: null,
          note: 'Customify file - download failed, external URL only',
        })
      }
    }

    if (fileRecords.length > 0) {
      await supabase.from('files').insert(fileRecords)
    }
  }

  // Auto-link recent emails from this customer
  if (customerEmail && newWorkItem) {
    const orderDate = new Date(order.created_at)
    const lookbackDate = new Date(orderDate)
    lookbackDate.setDate(lookbackDate.getDate() - 30)

    // For design fee orders, include emails up to NOW
    const upperBoundDate = orderType === 'custom_design_service'
      ? new Date()
      : orderDate

    const { data: recentEmails } = await supabase
      .from('communications')
      .select('id')
      .eq('from_email', customerEmail)
      .is('work_item_id', null)
      .gte('received_at', lookbackDate.toISOString())
      .lte('received_at', upperBoundDate.toISOString())

    if (recentEmails && recentEmails.length > 0) {
      await supabase
        .from('communications')
        .update({
          work_item_id: newWorkItem.id,
          triage_status: 'attached'
        })
        .in('id', recentEmails.map((e: any) => e.id))

      console.log(`Auto-linked ${recentEmails.length} emails to new work item ${newWorkItem.id}`)
    }
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
