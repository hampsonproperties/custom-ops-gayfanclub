import { NextRequest, NextResponse } from 'next/server'
import { getShopifyCredentials } from '@/lib/shopify/get-credentials'
import { SHOPIFY_API_VERSION } from '@/lib/config'
import { logger } from '@/lib/logger'
import { badRequest } from '@/lib/api/errors'

const log = logger('shopify-get-orders')

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const orderIds = searchParams.get('orderIds')?.split(',').filter(Boolean) || []
    const customerId = searchParams.get('customerId')
    const email = searchParams.get('email')

    if (orderIds.length === 0 && !customerId && !email) {
      return badRequest('Either orderIds, customerId, or email parameter required')
    }

    const { shop, accessToken } = await getShopifyCredentials()
    const orders = []

    // Fetch specific orders by ID
    for (const orderId of orderIds) {
      try {
        const response = await fetch(
          `https://${shop}/admin/api/${SHOPIFY_API_VERSION}/orders/${orderId}.json`,
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
        log.error('Failed to fetch order', { orderId, error })
      }
    }

    // Fetch customer orders by customer ID (preferred) or email
    let customerOrders = []

    if (customerId) {
      // Use customer ID - most reliable
      try {
        const ordersResponse = await fetch(
          `https://${shop}/admin/api/${SHOPIFY_API_VERSION}/customers/${customerId}/orders.json`,
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
      } catch (error) {
        log.error('Failed to fetch customer orders by ID', { customerId, error })
      }
    } else if (email) {
      // Fallback to email lookup
      try {
        // Search for customer by email
        const customerResponse = await fetch(
          `https://${shop}/admin/api/${SHOPIFY_API_VERSION}/customers/search.json?query=email:${encodeURIComponent(email)}`,
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
              `https://${shop}/admin/api/${SHOPIFY_API_VERSION}/customers/${customer.id}/orders.json`,
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
        log.error('Failed to fetch customer orders by email', { email, error })
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
    log.error('Get orders error', { error })
    return NextResponse.json(
      { error: 'Failed to fetch orders', message: error.message },
      { status: 500 }
    )
  }
}
