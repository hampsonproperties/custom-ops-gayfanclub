/**
 * Lookup customer in Shopify by email
 * Returns customer data if exists, null if not found
 */

import { getShopifyCredentials } from './get-credentials'
import { logger } from '@/lib/logger'

const log = logger('shopify-lookup-customer')

export interface ShopifyOrder {
  id: string
  order_number: string
  total_price: string
  financial_status: string
  fulfillment_status: string | null
  created_at: string
  line_items_count: number
}

export interface ShopifyCustomerLookup {
  exists: boolean
  customer?: {
    id: string
    email: string
    first_name: string
    last_name: string
    phone: string | null
    total_spent: string
    orders_count: number
    tags: string
    created_at: string
    updated_at: string
  }
  orders?: ShopifyOrder[]
}

export async function lookupShopifyCustomer(email: string): Promise<ShopifyCustomerLookup> {
  try {
    const { shop, accessToken } = await getShopifyCredentials()

    const response = await fetch(
      `https://${shop}/admin/api/2026-01/customers/search.json?query=email:${encodeURIComponent(email)}`,
      {
        headers: {
          'X-Shopify-Access-Token': accessToken,
          'Content-Type': 'application/json',
        },
      }
    )

    if (!response.ok) {
      log.error('Customer lookup failed', { status: response.status, body: await response.text() })
      return { exists: false }
    }

    const data = await response.json()
    const customers = data.customers || []

    if (customers.length === 0) {
      return { exists: false }
    }

    // Return first matching customer
    const customer = customers[0]
    const customerId = customer.id.toString()

    // Fetch customer orders
    let orders: ShopifyOrder[] = []
    try {
      const ordersResponse = await fetch(
        `https://${shop}/admin/api/2026-01/customers/${customerId}/orders.json?status=any&limit=20`,
        {
          headers: {
            'X-Shopify-Access-Token': accessToken,
            'Content-Type': 'application/json',
          },
        }
      )

      if (ordersResponse.ok) {
        const ordersData = await ordersResponse.json()
        orders = (ordersData.orders || []).map((order: any) => ({
          id: order.id.toString(),
          order_number: order.order_number?.toString() || order.name?.replace('#', '') || '',
          total_price: order.total_price || '0.00',
          financial_status: order.financial_status || 'pending',
          fulfillment_status: order.fulfillment_status || null,
          created_at: order.created_at,
          line_items_count: order.line_items?.length || 0,
        }))
      }
    } catch (error) {
      log.error('Error fetching customer orders', { error })
    }

    return {
      exists: true,
      customer: {
        id: customerId,
        email: customer.email,
        first_name: customer.first_name || '',
        last_name: customer.last_name || '',
        phone: customer.phone || customer.default_address?.phone || null,
        total_spent: customer.total_spent || '0.00',
        orders_count: customer.orders_count || 0,
        tags: customer.tags || '',
        created_at: customer.created_at,
        updated_at: customer.updated_at,
      },
      orders,
    }
  } catch (error) {
    log.error('Error looking up customer', { error })
    return { exists: false }
  }
}
