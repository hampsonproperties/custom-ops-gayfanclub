import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getShopifyCredentials } from '@/lib/shopify/get-credentials'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

export async function POST(request: NextRequest) {
  try {
    const { query } = await request.json()

    if (!query) {
      return NextResponse.json({ error: 'Query is required' }, { status: 400 })
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // Get stored credentials from database
    const { shop: shopifyDomain, accessToken: shopifyToken } = await getShopifyCredentials()

    // Search by order number or customer email
    const params = new URLSearchParams()
    params.append('limit', '50')
    params.append('status', 'any')

    // If query looks like an order number, search by name
    if (query.match(/^#?\d+$/)) {
      params.append('name', query.replace('#', ''))
    } else {
      // Otherwise search by email
      params.append('email', query)
    }

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
    const orders = data.orders || []

    // Check which orders are already imported
    const orderIds = orders.map((o: any) => o.id.toString())
    const { data: importedOrders } = await supabase
      .from('work_items')
      .select('shopify_order_id, id')
      .in('shopify_order_id', orderIds)

    const importedOrderIds = new Set(importedOrders?.map(w => w.shopify_order_id) || [])

    // Detect which orders are custom (Customify or Custom Design Service)
    const enrichedOrders = orders.map((order: any) => {
      const orderType = detectOrderType(order)
      const isCustom = !!orderType
      const isImported = importedOrderIds.has(order.id.toString())

      // Extract preview and calculate total quantity
      let previewUrl = null
      let totalQuantity = 0
      for (const item of order.line_items || []) {
        totalQuantity += item.quantity || 0
        if (item.properties) {
          const props = Array.isArray(item.properties) ? item.properties : []
          for (const prop of props) {
            if (prop.name === 'design_preview' || prop.name === '_design_preview_url' || prop.name === 'Preview') {
              previewUrl = prop.value
              break
            }
          }
        }
        if (previewUrl) break
      }

      return {
        id: order.id,
        name: order.name,
        email: order.customer?.email,
        customerName: order.customer ? `${order.customer.first_name || ''} ${order.customer.last_name || ''}`.trim() : null,
        financialStatus: order.financial_status,
        fulfillmentStatus: order.fulfillment_status,
        totalPrice: order.total_price,
        currency: order.currency,
        createdAt: order.created_at,
        isCustom,
        orderType,
        previewUrl,
        lineItemsCount: totalQuantity,
        isImported,
      }
    })

    return NextResponse.json({
      orders: enrichedOrders,
      total: enrichedOrders.length,
    })
  } catch (error) {
    console.error('Search error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Search failed' },
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
          hasCustomifyProperties = true
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
