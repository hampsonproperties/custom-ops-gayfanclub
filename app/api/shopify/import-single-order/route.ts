import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getShopifyCredentials } from '@/lib/shopify/get-credentials'
import { detectOrderType } from '@/lib/shopify/detect-order-type'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

export async function POST(request: NextRequest) {
  const supabase = createClient(supabaseUrl, supabaseServiceKey)

  try {
    const { orderId } = await request.json()

    if (!orderId) {
      return NextResponse.json({ error: 'Order ID is required' }, { status: 400 })
    }

    // Get stored credentials from database
    const { shop: shopifyDomain, accessToken: shopifyToken } = await getShopifyCredentials()

    const response = await fetch(
      `https://${shopifyDomain}/admin/api/2024-01/orders/${orderId}.json`,
      {
        headers: {
          'X-Shopify-Access-Token': shopifyToken,
          'Content-Type': 'application/json',
        },
      }
    )

    if (!response.ok) {
      throw new Error(`Shopify API error: ${response.statusText}`)
    }

    const data = await response.json()
    const order = data.order

    // Check if already imported (check both production and design fee order IDs)
    const shopifyOrderId = order.id.toString()
    const { data: existing } = await supabase
      .from('work_items')
      .select('id, shopify_order_number, design_fee_order_number')
      .or(`shopify_order_id.eq.${shopifyOrderId},design_fee_order_id.eq.${shopifyOrderId}`)
      .maybeSingle()

    if (existing) {
      return NextResponse.json(
        { error: 'Order already imported', workItemId: existing.id },
        { status: 409 }
      )
    }

    // Detect order type
    const orderType = detectOrderType(order)

    if (!orderType) {
      return NextResponse.json(
        { error: 'Not a custom order (not Customify or Custom Design Service)' },
        { status: 400 }
      )
    }

    // Extract data from order
    const customerEmail = order.customer?.email
    const customerName = order.customer
      ? `${order.customer.first_name || ''} ${order.customer.last_name || ''}`.trim()
      : null

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

          if (propName === 'design_preview' || propName === '_design_preview_url' || propName === 'preview') {
            designPreviewUrl = propValue
          }
          if (propName === 'design_download' || propName === '_design_download_url') {
            designDownloadUrl = propValue
          }
          if (propName === 'grip_color' || propName === 'grip color') {
            gripColor = propValue
          }

          // Collect Customify files
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

    // Check if there's an existing work item for this customer email
    let workItemId = null

    // Link design fee orders to existing inquiries
    if (orderType === 'custom_design_service' && customerEmail) {
      const { data: existingWorkItem } = await supabase
        .from('work_items')
        .select('id, status')
        .eq('customer_email', customerEmail)
        .eq('type', 'assisted_project')
        .in('status', ['new_inquiry', 'design_fee_sent', 'info_sent'])
        .is('closed_at', null)
        .order('created_at', { ascending: false })
        .limit(1)
        .single()

      if (existingWorkItem) {
        // Update existing work item with design fee order (NOT production order)
        await supabase
          .from('work_items')
          .update({
            design_fee_order_id: order.id.toString(),
            design_fee_order_number: order.name,
            shopify_financial_status: order.financial_status,
            shopify_fulfillment_status: order.fulfillment_status,
            customer_name: customerName,
            status: 'design_fee_paid',
          })
          .eq('id', existingWorkItem.id)

        // Create status event
        await supabase.from('work_item_status_events').insert({
          work_item_id: existingWorkItem.id,
          from_status: existingWorkItem.status,
          to_status: 'design_fee_paid',
          changed_by_user_id: null,
          note: `Design fee paid via Shopify order ${order.name}`,
        })

        workItemId = existingWorkItem.id

        // Auto-link recent emails from this customer
        if (customerEmail) {
          const orderDate = new Date(order.created_at)
          const lookbackDate = new Date(orderDate)
          lookbackDate.setDate(lookbackDate.getDate() - 30)

          const { data: recentEmails } = await supabase
            .from('communications')
            .select('id')
            .eq('from_email', customerEmail)
            .is('work_item_id', null)
            .gte('received_at', lookbackDate.toISOString())
            .lte('received_at', orderDate.toISOString())

          if (recentEmails && recentEmails.length > 0) {
            await supabase
              .from('communications')
              .update({
                work_item_id: workItemId,
                triage_status: 'attached'
              })
              .in('id', recentEmails.map(e => e.id))

            console.log(`Auto-linked ${recentEmails.length} emails to work item ${workItemId}`)
          }
        }

        return NextResponse.json({
          success: true,
          action: 'updated',
          workItemId,
          message: 'Linked to existing work item',
        })
      }
    }

    // Link bulk/invoice orders to existing assisted projects awaiting payment
    if (orderType === 'custom_bulk_order' && customerEmail) {
      const { data: existingWorkItem, error: linkError } = await supabase
        .from('work_items')
        .select('id, status, quantity, grip_color')
        .eq('customer_email', customerEmail)
        .eq('type', 'assisted_project')
        .in('status', ['design_fee_paid', 'in_design', 'proof_sent', 'awaiting_approval', 'invoice_sent'])
        .is('closed_at', null)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()

      console.log('Linking search result:', { existingWorkItem, linkError, customerEmail })

      if (existingWorkItem) {
        // Update existing work item with production order details
        await supabase
          .from('work_items')
          .update({
            shopify_order_id: order.id.toString(),
            shopify_order_number: order.name,
            shopify_financial_status: order.financial_status,
            shopify_fulfillment_status: order.fulfillment_status,
            customer_name: customerName,
            quantity: quantity || existingWorkItem.quantity,
            grip_color: gripColor || existingWorkItem.grip_color,
            status: 'paid_ready_for_batch',
          })
          .eq('id', existingWorkItem.id)

        // Create status event
        await supabase.from('work_item_status_events').insert({
          work_item_id: existingWorkItem.id,
          from_status: existingWorkItem.status,
          to_status: 'paid_ready_for_batch',
          changed_by_user_id: null,
          note: `Production order paid via Shopify order ${order.name}`,
        })

        workItemId = existingWorkItem.id

        // Auto-link recent emails from this customer
        if (customerEmail) {
          const orderDate = new Date(order.created_at)
          const lookbackDate = new Date(orderDate)
          lookbackDate.setDate(lookbackDate.getDate() - 30)

          const { data: recentEmails } = await supabase
            .from('communications')
            .select('id')
            .eq('from_email', customerEmail)
            .is('work_item_id', null)
            .gte('received_at', lookbackDate.toISOString())
            .lte('received_at', orderDate.toISOString())

          if (recentEmails && recentEmails.length > 0) {
            await supabase
              .from('communications')
              .update({
                work_item_id: workItemId,
                triage_status: 'attached'
              })
              .in('id', recentEmails.map(e => e.id))

            console.log(`Auto-linked ${recentEmails.length} emails to work item ${workItemId}`)
          }
        }

        return NextResponse.json({
          success: true,
          action: 'updated',
          workItemId,
          message: 'Linked to existing assisted project',
        })
      }
    }

    // Create new work item
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
        detected_via: 'manual_import',
        order_type: orderType,
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

    const { data: newWorkItem, error: insertError } = await supabase
      .from('work_items')
      .insert(insertData)
      .select()
      .single()

    if (insertError) {
      throw new Error(`Failed to create work item: ${insertError.message}`)
    }

    workItemId = newWorkItem.id

    // Create file records for Customify files
    if (customifyFiles.length > 0) {
      const fileRecords = customifyFiles.map((file, index) => ({
        work_item_id: workItemId,
        kind: file.kind,
        version: index + 1,
        original_filename: file.filename,
        normalized_filename: file.filename,
        storage_bucket: 'customify',
        storage_path: file.url,
        mime_type: 'image/png',
        size_bytes: null,
        uploaded_by_user_id: null,
        note: 'Imported from Shopify order',
      }))

      await supabase.from('files').insert(fileRecords)
    }

    // Auto-link recent emails from this customer (last 30 days before order)
    if (customerEmail) {
      const orderDate = new Date(order.created_at)
      const lookbackDate = new Date(orderDate)
      lookbackDate.setDate(lookbackDate.getDate() - 30)

      const { data: recentEmails } = await supabase
        .from('communications')
        .select('id')
        .eq('from_email', customerEmail)
        .is('work_item_id', null)
        .gte('received_at', lookbackDate.toISOString())
        .lte('received_at', orderDate.toISOString())

      if (recentEmails && recentEmails.length > 0) {
        await supabase
          .from('communications')
          .update({
            work_item_id: workItemId,
            triage_status: 'attached'
          })
          .in('id', recentEmails.map(e => e.id))

        console.log(`Auto-linked ${recentEmails.length} emails to new work item ${workItemId}`)
      }
    }

    return NextResponse.json({
      success: true,
      action: 'created',
      workItemId,
      filesImported: customifyFiles.length,
      message: 'Order imported successfully',
    })
  } catch (error) {
    console.error('Import error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Import failed' },
      { status: 500 }
    )
  }
}
