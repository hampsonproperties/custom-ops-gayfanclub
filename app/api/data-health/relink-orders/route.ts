/**
 * Re-link Orphaned Orders
 * Finds customer_orders with NULL customer_id and tries to match them
 * to existing customers by email address or shopify_customer_id.
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { requireAuth } from '@/lib/api/require-auth'
import { logger } from '@/lib/logger'
import { serverError } from '@/lib/api/errors'

const log = logger('data-health-relink-orders')

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

export async function POST(request: NextRequest) {
  try {
    const auth = await requireAuth()
    if (auth.response) return auth.response

    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    log.info('Starting orphaned order re-linking', { userId: auth.user.id })

    // Fetch orphaned orders — join with shopify_orders to get email
    const { data: orphaned, error: fetchError } = await supabase
      .from('customer_orders')
      .select('id, shopify_order_id, shopify_customer_id')
      .is('customer_id', null)
      .limit(500)

    if (fetchError) {
      log.error('Failed to fetch orphaned orders', { error: fetchError })
      return serverError('Failed to fetch orphaned orders')
    }

    if (!orphaned || orphaned.length === 0) {
      return NextResponse.json({ success: true, relinked: 0, total_orphaned: 0 })
    }

    log.info('Found orphaned orders', { count: orphaned.length })

    let relinked = 0
    const errors: string[] = []

    for (const order of orphaned) {
      try {
        let customerId: string | null = null

        // Strategy 1: Match by shopify_customer_id
        if (order.shopify_customer_id) {
          const { data: customer } = await supabase
            .from('customers')
            .select('id')
            .eq('shopify_customer_id', order.shopify_customer_id)
            .limit(1)
            .single()

          if (customer) {
            customerId = customer.id
          }
        }

        // Strategy 2: Match by email from shopify_orders
        if (!customerId && order.shopify_order_id) {
          const { data: shopifyOrder } = await supabase
            .from('shopify_orders')
            .select('customer_email')
            .eq('shopify_order_id', order.shopify_order_id)
            .limit(1)
            .single()

          if (shopifyOrder?.customer_email) {
            const { data: customer } = await supabase
              .from('customers')
              .select('id')
              .eq('email', shopifyOrder.customer_email.toLowerCase())
              .limit(1)
              .single()

            if (customer) {
              customerId = customer.id
            }
          }
        }

        if (customerId) {
          const { error: updateError } = await supabase
            .from('customer_orders')
            .update({ customer_id: customerId })
            .eq('id', order.id)

          if (updateError) {
            errors.push(`Order ${order.id}: ${updateError.message}`)
          } else {
            relinked++
            // The DB trigger will auto-recalculate aggregates for this customer
          }
        }
      } catch (err: any) {
        errors.push(`Order ${order.id}: ${err.message}`)
      }
    }

    log.info('Order re-linking complete', { relinked, total: orphaned.length, errorCount: errors.length })

    return NextResponse.json({
      success: true,
      relinked,
      total_orphaned: orphaned.length,
      errors: errors.length > 0 ? errors : undefined,
    })
  } catch (error: any) {
    log.error('Order re-linking error', { error })
    return serverError('An error occurred during order re-linking')
  }
}
