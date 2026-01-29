import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  try {
    const { query } = await request.json()

    if (!query) {
      return NextResponse.json({ error: 'Query is required' }, { status: 400 })
    }

    const shopifyDomain = process.env.SHOPIFY_STORE_DOMAIN!
    const shopifyToken = process.env.SHOPIFY_ADMIN_API_TOKEN!

    if (!shopifyDomain || !shopifyToken) {
      return NextResponse.json(
        { error: 'Shopify credentials not configured' },
        { status: 500 }
      )
    }

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

    // Detect which orders are custom (Customify or Custom Design Service)
    const enrichedOrders = orders.map((order: any) => {
      const orderType = detectOrderType(order)
      const isCustom = !!orderType

      // Extract preview if available
      let previewUrl = null
      for (const item of order.line_items || []) {
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
        lineItemsCount: order.line_items?.length || 0,
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

  const tags = order.tags?.toLowerCase() || ''
  if (tags.includes('customify')) {
    return 'customify_order'
  }
  if (tags.includes('custom design')) {
    return 'custom_design_service'
  }

  return null
}
