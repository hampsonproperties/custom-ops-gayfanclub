import { NextRequest, NextResponse } from 'next/server'
import { getShopifyCredentials } from '@/lib/shopify/get-credentials'

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const orderIds = searchParams.get('orderIds')?.split(',').filter(Boolean) || []
    const email = searchParams.get('email')

    if (orderIds.length === 0 && !email) {
      return NextResponse.json(
        { error: 'Either orderIds or email parameter required' },
        { status: 400 }
      )
    }

    const { shop, accessToken } = await getShopifyCredentials()
    const orders = []

    // Fetch specific orders by ID
    for (const orderId of orderIds) {
      try {
        const response = await fetch(
          `https://${shop}/admin/api/2026-01/orders/${orderId}.json`,
          {
            headers: {
              'X-Shopify-Access-Token': accessToken,
              'Content-Type': 'application/json',
            },
          }
        )

        if (response.ok) {
          const data = await response.json()
          orders.push(data.order)
        }
      } catch (error) {
        console.error(`[Shopify] Failed to fetch order ${orderId}:`, error)
      }
    }

    // Also fetch customer orders by email if provided
    let customerOrders = []
    if (email) {
      try {
        // Search for customer by email
        const customerResponse = await fetch(
          `https://${shop}/admin/api/2026-01/customers/search.json?query=email:${encodeURIComponent(email)}`,
          {
            headers: {
              'X-Shopify-Access-Token': accessToken,
              'Content-Type': 'application/json',
            },
          }
        )

        if (customerResponse.ok) {
          const customerData = await customerResponse.json()
          if (customerData.customers && customerData.customers.length > 0) {
            const customer = customerData.customers[0]

            // Fetch all orders for this customer
            const ordersResponse = await fetch(
              `https://${shop}/admin/api/2026-01/customers/${customer.id}/orders.json`,
              {
                headers: {
                  'X-Shopify-Access-Token': accessToken,
                  'Content-Type': 'application/json',
                },
              }
            )

            if (ordersResponse.ok) {
              const ordersData = await ordersResponse.json()
              customerOrders = ordersData.orders || []
            }
          }
        }
      } catch (error) {
        console.error('[Shopify] Failed to fetch customer orders:', error)
      }
    }

    // Merge orders (deduplicate by ID)
    const allOrders = [...orders]
    const existingIds = new Set(orders.map(o => o.id.toString()))

    for (const order of customerOrders) {
      if (!existingIds.has(order.id.toString())) {
        allOrders.push(order)
      }
    }

    return NextResponse.json({
      success: true,
      orders: allOrders,
      count: allOrders.length,
    })
  } catch (error: any) {
    console.error('[API] Get orders error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch orders', message: error.message },
      { status: 500 }
    )
  }
}
