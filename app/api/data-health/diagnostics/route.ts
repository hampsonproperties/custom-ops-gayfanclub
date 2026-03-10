/**
 * Data Health Diagnostics API
 * Runs all diagnostic queries in parallel and returns counts of data issues.
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { requireAuth } from '@/lib/api/require-auth'
import { logger } from '@/lib/logger'
import { serverError } from '@/lib/api/errors'

const log = logger('data-health-diagnostics')

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

export async function POST(request: NextRequest) {
  try {
    const auth = await requireAuth()
    if (auth.response) return auth.response

    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    log.info('Running data health diagnostics', { userId: auth.user.id })

    // Run all diagnostic queries in parallel
    const [
      unlinkedShopify,
      aggregateMismatches,
      duplicateCustomers,
      orphanedOrders,
      unlinkedComms,
      orphanedWorkItems,
      dlqFailed,
    ] = await Promise.all([
      // 1. Customers missing shopify_customer_id
      supabase
        .from('customers')
        .select('id', { count: 'exact', head: true })
        .is('shopify_customer_id', null)
        .not('email', 'is', null)
        .neq('email', ''),

      // 2. Aggregate mismatches (via RPC function)
      supabase.rpc('count_aggregate_mismatches'),

      // 3. Duplicate customers (via RPC function)
      supabase.rpc('count_duplicate_customers'),

      // 4. Orphaned customer_orders (no customer_id)
      supabase
        .from('customer_orders')
        .select('id', { count: 'exact', head: true })
        .is('customer_id', null),

      // 5. Unlinked communications (no customer_id)
      supabase
        .from('communications')
        .select('id', { count: 'exact', head: true })
        .is('customer_id', null),

      // 6. Open work items with no customer
      supabase
        .from('work_items')
        .select('id', { count: 'exact', head: true })
        .is('customer_id', null)
        .is('closed_at', null),

      // 7. DLQ failed items
      supabase
        .from('dead_letter_queue')
        .select('id', { count: 'exact', head: true })
        .eq('status', 'failed'),
    ])

    // Extract counts, handling errors gracefully
    const diagnostics = {
      unlinked_shopify: unlinkedShopify.count ?? 0,
      aggregate_mismatches: aggregateMismatches.data?.[0]?.mismatch_count ?? 0,
      aggregate_details: aggregateMismatches.data?.[0]?.details ?? [],
      duplicate_customers: duplicateCustomers.data?.[0]?.duplicate_count ?? 0,
      duplicate_details: duplicateCustomers.data?.[0]?.details ?? [],
      orphaned_orders: orphanedOrders.count ?? 0,
      unlinked_communications: unlinkedComms.count ?? 0,
      orphaned_work_items: orphanedWorkItems.count ?? 0,
      dlq_failed: dlqFailed.count ?? 0,
    }

    // Log any query errors
    const errors: string[] = []
    if (unlinkedShopify.error) errors.push(`unlinked_shopify: ${unlinkedShopify.error.message}`)
    if (aggregateMismatches.error) errors.push(`aggregate_mismatches: ${aggregateMismatches.error.message}`)
    if (duplicateCustomers.error) errors.push(`duplicate_customers: ${duplicateCustomers.error.message}`)
    if (orphanedOrders.error) errors.push(`orphaned_orders: ${orphanedOrders.error.message}`)
    if (unlinkedComms.error) errors.push(`unlinked_communications: ${unlinkedComms.error.message}`)
    if (orphanedWorkItems.error) errors.push(`orphaned_work_items: ${orphanedWorkItems.error.message}`)
    if (dlqFailed.error) errors.push(`dlq_failed: ${dlqFailed.error.message}`)

    if (errors.length > 0) {
      log.warn('Some diagnostic queries had errors', { errors })
    }

    log.info('Diagnostics complete', { diagnostics: {
      unlinked_shopify: diagnostics.unlinked_shopify,
      aggregate_mismatches: diagnostics.aggregate_mismatches,
      duplicate_customers: diagnostics.duplicate_customers,
      orphaned_orders: diagnostics.orphaned_orders,
      unlinked_communications: diagnostics.unlinked_communications,
      orphaned_work_items: diagnostics.orphaned_work_items,
      dlq_failed: diagnostics.dlq_failed,
    }})

    return NextResponse.json({
      success: true,
      diagnostics,
      errors: errors.length > 0 ? errors : undefined,
      timestamp: new Date().toISOString(),
    })
  } catch (error: any) {
    log.error('Diagnostics failed', { error })
    return serverError('Failed to run data health diagnostics')
  }
}
