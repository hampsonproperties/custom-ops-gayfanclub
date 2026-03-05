/**
 * Shopify Customer Orders Service Layer
 *
 * Manages customer master records and customer orders
 * Enables unlimited orders per customer with proper aggregation
 */

import { SupabaseClient } from '@supabase/supabase-js'
import { logger } from '@/lib/logger'

const log = logger('shopify-customer-orders')

interface ShopifyCustomer {
  id: string | number
  email?: string
  first_name?: string
  last_name?: string
  phone?: string
  tags?: string
  note?: string
  default_address?: any
}

interface ShopifyOrder {
  id: string | number
  name: string
  customer?: ShopifyCustomer
  total_price?: string
  currency?: string
  financial_status?: string
  fulfillment_status?: string
  transactions?: any[]
  tags?: string
  note?: string
  line_items?: any[]
  created_at?: string
  updated_at?: string
}

interface CustomerOrder {
  id: string
  customer_id: string | null
  work_item_id: string | null
  shopify_order_id: string
  shopify_order_number: string
  shopify_customer_id: string | null
  order_type: string
  total_price: number | null
  currency: string
  financial_status: string | null
  fulfillment_status: string | null
  payment_history: any
  tags: string[]
  note: string | null
  line_items: any
  shopify_created_at: string | null
  shopify_updated_at: string | null
  created_at: string
  updated_at: string
}

/**
 * Find or create a customer master record
 *
 * Upserts customer by email or shopify_customer_id
 * Updates tags and metadata from Shopify
 *
 * @param supabase - Supabase client
 * @param shopifyCustomer - Shopify customer data
 * @returns Customer ID
 */
export async function findOrCreateCustomer(
  supabase: SupabaseClient,
  shopifyCustomer: ShopifyCustomer | undefined
): Promise<string | null> {
  if (!shopifyCustomer) {
    return null
  }

  const email = shopifyCustomer.email?.toLowerCase()
  const shopifyCustomerId = shopifyCustomer.id?.toString()
  const firstName = shopifyCustomer.first_name || null
  const lastName = shopifyCustomer.last_name || null
  const displayName = [firstName, lastName].filter(Boolean).join(' ') || null

  // Extract tags
  const tags = shopifyCustomer.tags
    ?.split(',')
    .map((t) => t.trim())
    .filter(Boolean) || []

  // Build metadata
  const metadata = {
    shopify_note: shopifyCustomer.note,
    phone: shopifyCustomer.phone,
    address: shopifyCustomer.default_address,
  }

  if (!email && !shopifyCustomerId) {
    return null
  }

  try {
    // Try to find existing customer by email or shopify_customer_id
    let existingCustomer = null

    if (email) {
      const { data } = await supabase
        .from('customers')
        .select('id')
        .eq('email', email)
        .maybeSingle()

      existingCustomer = data
    }

    if (!existingCustomer && shopifyCustomerId) {
      const { data } = await supabase
        .from('customers')
        .select('id')
        .eq('shopify_customer_id', shopifyCustomerId)
        .maybeSingle()

      existingCustomer = data
    }

    if (existingCustomer) {
      // Update existing customer
      await supabase
        .from('customers')
        .update({
          first_name: firstName,
          last_name: lastName,
          display_name: displayName,
          shopify_customer_id: shopifyCustomerId,
          tags,
          metadata,
          updated_at: new Date().toISOString(),
        })
        .eq('id', existingCustomer.id)

      return existingCustomer.id
    } else {
      // Create new customer
      const { data: newCustomer, error } = await supabase
        .from('customers')
        .insert({
          email,
          first_name: firstName,
          last_name: lastName,
          display_name: displayName,
          shopify_customer_id: shopifyCustomerId,
          tags,
          metadata,
        })
        .select('id')
        .single()

      if (error) {
        log.error('Failed to create customer', { error })
        return null
      }

      return newCustomer.id
    }
  } catch (error) {
    log.error('Error in findOrCreateCustomer', { error })
    return null
  }
}

/**
 * Create a customer order record
 *
 * Tracks the order in customer_orders table
 * Links to customer and optionally to work_item
 * Triggers customer aggregate updates via database trigger
 *
 * @param supabase - Supabase client
 * @param order - Shopify order data
 * @param orderType - Detected order type
 * @param workItemId - Optional work item ID to link
 * @returns Customer order ID
 */
export async function createCustomerOrder(
  supabase: SupabaseClient,
  order: ShopifyOrder,
  orderType: string,
  workItemId?: string
): Promise<string | null> {
  try {
    // Find or create customer first
    const customerId = await findOrCreateCustomer(supabase, order.customer)

    // Extract payment history
    const paymentHistory = (order.transactions || []).map((tx: any) => ({
      transaction_id: tx.id?.toString(),
      amount: tx.amount,
      currency: tx.currency,
      status: tx.status,
      kind: tx.kind,
      gateway: tx.gateway,
      paid_at: tx.processed_at,
    }))

    // Extract order tags
    const orderTags = order.tags
      ?.split(',')
      .map((t) => t.trim())
      .filter(Boolean) || []

    // Check if order already exists (by shopify_order_id)
    const { data: existingOrder } = await supabase
      .from('customer_orders')
      .select('id')
      .eq('shopify_order_id', order.id.toString())
      .maybeSingle()

    if (existingOrder) {
      // Update existing order
      await supabase
        .from('customer_orders')
        .update({
          customer_id: customerId,
          work_item_id: workItemId || null,
          shopify_order_number: order.name,
          shopify_customer_id: order.customer?.id?.toString(),
          order_type: orderType,
          total_price: order.total_price ? parseFloat(order.total_price) : null,
          currency: order.currency || 'USD',
          financial_status: order.financial_status,
          fulfillment_status: order.fulfillment_status,
          payment_history: paymentHistory,
          tags: orderTags,
          note: order.note,
          line_items: order.line_items,
          shopify_updated_at: order.updated_at,
          updated_at: new Date().toISOString(),
        })
        .eq('id', existingOrder.id)

      return existingOrder.id
    } else {
      // Create new order
      const { data: newOrder, error } = await supabase
        .from('customer_orders')
        .insert({
          customer_id: customerId,
          work_item_id: workItemId || null,
          shopify_order_id: order.id.toString(),
          shopify_order_number: order.name,
          shopify_customer_id: order.customer?.id?.toString(),
          order_type: orderType,
          total_price: order.total_price ? parseFloat(order.total_price) : null,
          currency: order.currency || 'USD',
          financial_status: order.financial_status,
          fulfillment_status: order.fulfillment_status,
          payment_history: paymentHistory,
          tags: orderTags,
          note: order.note,
          line_items: order.line_items,
          shopify_created_at: order.created_at,
          shopify_updated_at: order.updated_at,
        })
        .select('id')
        .single()

      if (error) {
        log.error('Failed to create customer order', { error })
        return null
      }

      return newOrder.id
    }
  } catch (error) {
    log.error('Error in createCustomerOrder', { error })
    return null
  }
}

/**
 * Link an order to a work item
 *
 * Updates the work_item_id field on a customer_order
 *
 * @param supabase - Supabase client
 * @param orderId - Customer order ID
 * @param workItemId - Work item ID to link
 */
export async function linkOrderToWorkItem(
  supabase: SupabaseClient,
  orderId: string,
  workItemId: string
): Promise<void> {
  try {
    await supabase
      .from('customer_orders')
      .update({ work_item_id: workItemId })
      .eq('id', orderId)
  } catch (error) {
    log.error('Error linking order to work item', { error, orderId, workItemId })
  }
}

/**
 * Get order history for a customer
 *
 * Fetches all orders with work item details
 *
 * @param supabase - Supabase client
 * @param customerId - Customer ID
 * @returns Array of customer orders
 */
export async function getCustomerOrderHistory(
  supabase: SupabaseClient,
  customerId: string
): Promise<CustomerOrder[]> {
  try {
    const { data, error } = await supabase
      .from('customer_orders')
      .select(
        `
        *,
        work_items (
          id,
          type,
          status,
          quantity
        )
      `
      )
      .eq('customer_id', customerId)
      .order('shopify_created_at', { ascending: false })

    if (error) {
      log.error('Error fetching customer order history', { error, customerId })
      return []
    }

    return data || []
  } catch (error) {
    log.error('Error in getCustomerOrderHistory', { error, customerId })
    return []
  }
}
