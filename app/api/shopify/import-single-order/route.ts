import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

export async function POST(request: NextRequest) {
  const supabase = createClient(supabaseUrl, supabaseServiceKey)

  try {
    const { orderId } = await request.json()

    if (!orderId) {
      return NextResponse.json({ error: 'Order ID is required' }, { status: 400 })
    }

    // Fetch the specific order from Shopify
    const shopifyDomain = process.env.SHOPIFY_STORE_DOMAIN!
    const shopifyToken = process.env.SHOPIFY_ADMIN_API_TOKEN!

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

    // Check if already imported
    const { data: existing } = await supabase
      .from('work_items')
      .select('id, shopify_order_number')
      .eq('shopify_order_id', order.id.toString())
      .single()

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
      quantity += item.quantity
    }

    // Check if there's an existing work item for this customer email
    let workItemId = null
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
        // Update existing work item
        await supabase
          .from('work_items')
          .update({
            shopify_order_id: order.id.toString(),
            shopify_order_number: order.name,
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

        return NextResponse.json({
          success: true,
          action: 'updated',
          workItemId,
          message: 'Linked to existing work item',
        })
      }
    }

    // Create new work item
    const workItemType = orderType === 'custom_design_service' ? 'assisted_project' : 'customify_order'
    const workItemStatus = orderType === 'custom_design_service' ? 'design_fee_paid' : 'needs_design_review'

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
          detected_via: 'manual_import',
          order_type: orderType,
        },
      })
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

function detectOrderType(order: any): 'customify_order' | 'custom_design_service' | null {
  // Check for Custom Design Service
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

  // Check for Customify
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

    const title = item.title?.toLowerCase() || ''
    if (title.includes('customify')) {
      return 'customify_order'
    }
  }

  return null
}
