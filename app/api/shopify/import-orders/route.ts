import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

export async function POST(request: NextRequest) {
  const supabase = createClient(supabaseUrl, supabaseServiceKey)

  try {
    const { orderIds, startDate, endDate } = await request.json()

    // Fetch orders from Shopify Admin API
    const shopifyDomain = process.env.SHOPIFY_STORE_DOMAIN!
    const shopifyToken = process.env.SHOPIFY_ADMIN_API_TOKEN!

    let orders = []

    // Build query parameters
    const params = new URLSearchParams()
    if (startDate) params.append('created_at_min', startDate)
    if (endDate) params.append('created_at_max', endDate)
    params.append('limit', '250')
    params.append('status', 'any')

    const response = await fetch(
      `https://${shopifyDomain}/admin/api/2024-01/orders.json?${params}`,
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
    orders = data.orders || []

    // Filter for specific order IDs if provided
    if (orderIds && orderIds.length > 0) {
      orders = orders.filter((order: any) => orderIds.includes(order.id.toString()))
    }

    const results = {
      total: orders.length,
      imported: 0,
      skipped: 0,
      errors: [] as string[],
    }

    // Process each order
    for (const order of orders) {
      try {
        // Detect if it's a custom order
        const orderType = detectOrderType(order)
        if (!orderType) {
          results.skipped++
          continue
        }

        // Check if already exists
        const { data: existing } = await supabase
          .from('work_items')
          .select('id')
          .eq('shopify_order_id', order.id.toString())
          .single()

        if (existing) {
          results.skipped++
          continue
        }

        // Extract data
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

        const workItemType = (orderType === 'custom_design_service' || orderType === 'custom_bulk_order') ? 'assisted_project' : 'customify_order'
        const workItemStatus = orderType === 'custom_design_service' ? 'design_fee_paid' :
                               orderType === 'custom_bulk_order' ? 'paid_ready_for_batch' :
                               'approved'

        // Create work item
        const { data: newWorkItem, error: insertError } = await supabase
          .from('work_items')
          .insert({
            type: workItemType,
            source: 'shopify',
            status: workItemStatus, // Set to approved since they're old orders
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
              detected_via: 'bulk_import',
              order_type: orderType,
              order_tags: order.tags,
            },
          })
          .select()
          .single()

        if (insertError) {
          results.errors.push(`Order ${order.name}: ${insertError.message}`)
          continue
        }

        // Create file records
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
            note: 'Imported from historical order',
          }))

          await supabase.from('files').insert(fileRecords)
        }

        results.imported++
      } catch (error) {
        results.errors.push(`Order ${order.name}: ${error instanceof Error ? error.message : String(error)}`)
      }
    }

    return NextResponse.json(results)
  } catch (error) {
    console.error('Import error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Import failed' },
      { status: 500 }
    )
  }
}

function detectOrderType(order: any): 'customify_order' | 'custom_design_service' | 'custom_bulk_order' | null {
  // Check for Custom Design Service
  for (const item of order.line_items || []) {
    const title = item.title?.toLowerCase() || ''
    if (
      title.includes('professional custom fan design service') ||
      title.includes('custom fan design service') ||
      title.includes('design service & credit') ||
      title.includes('custom fan designer')
    ) {
      return 'custom_design_service'
    }
  }

  // Check for Etsy custom orders (has Personalization properties)
  for (const item of order.line_items || []) {
    if (item.properties) {
      const props = Array.isArray(item.properties) ? item.properties : []
      for (const prop of props) {
        const propName = prop.name?.toLowerCase() || ''
        if (propName.includes('personalization')) {
          return 'custom_design_service'
        }
      }
    }
  }

  // Check for Customify (has Customify properties)
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

  // Check for bulk orders (customer-provided artwork)
  for (const item of order.line_items || []) {
    const title = item.title?.toLowerCase() || ''
    if (title.includes('bulk order') || title.includes('bulk fan') || title.includes('custom bulk')) {
      return 'custom_bulk_order'
    }
  }

  // Check order tags
  const tags = order.tags?.toLowerCase() || ''
  if (tags.includes('customify')) {
    return 'customify_order'
  }
  if (tags.includes('custom bulk')) {
    return 'custom_bulk_order'
  }
  if (tags.includes('custom design')) {
    return 'custom_design_service'
  }

  return null
}
