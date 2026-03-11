/**
 * Cron Job: Sync Shopify Timeline Comments
 *
 * GET /api/cron/sync-shopify-comments
 *
 * Syncs timeline comments from Shopify for all active (non-closed) work items
 * that have a linked Shopify order. Runs every 30 minutes via Vercel Cron.
 *
 * Security: Requires CRON_SECRET in Authorization header
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { syncOrderComments } from '@/lib/shopify/processors/comment-sync'
import { unauthorized, serverError } from '@/lib/api/errors'
import { logger } from '@/lib/logger'

const log = logger('cron-sync-shopify-comments')

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

// Statuses that mean the work item is closed/done
const CLOSED_STATUSES = ['closed', 'closed_won', 'closed_lost', 'closed_event_cancelled', 'shipped']

export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization')
    const expectedAuth = `Bearer ${process.env.CRON_SECRET}`

    if (!process.env.CRON_SECRET) {
      log.error('CRON_SECRET not configured')
      return serverError('Cron secret not configured')
    }

    if (authHeader !== expectedAuth) {
      log.error('Unauthorized cron request')
      return unauthorized('Unauthorized')
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // Get all active work items with a linked Shopify order
    const { data: workItems, error: fetchError } = await supabase
      .from('work_items')
      .select('id, shopify_order_id, design_fee_order_id')
      .not('status', 'in', `(${CLOSED_STATUSES.join(',')})`)
      .or('shopify_order_id.not.is.null,design_fee_order_id.not.is.null')
      .limit(200)

    if (fetchError) {
      log.error('Failed to fetch work items for comment sync', { error: fetchError })
      return serverError('Failed to fetch work items')
    }

    if (!workItems || workItems.length === 0) {
      return NextResponse.json({ success: true, synced: 0, workItems: 0 })
    }

    log.info('Starting Shopify comment sync', { workItemCount: workItems.length })

    let totalSynced = 0
    let errorCount = 0

    for (const workItem of workItems) {
      try {
        const orderIds: string[] = []
        if (workItem.shopify_order_id) orderIds.push(workItem.shopify_order_id)
        if (workItem.design_fee_order_id) orderIds.push(workItem.design_fee_order_id)

        for (const orderId of orderIds) {
          const synced = await syncOrderComments(supabase, orderId, workItem.id)
          totalSynced += synced
        }
      } catch (err) {
        errorCount++
        log.error('Error syncing comments for work item', { workItemId: workItem.id, error: err })
      }
    }

    log.info('Shopify comment sync complete', {
      workItems: workItems.length,
      totalSynced,
      errors: errorCount,
    })

    return NextResponse.json({
      success: true,
      workItems: workItems.length,
      synced: totalSynced,
      errors: errorCount,
    })
  } catch (error) {
    log.error('Shopify comment sync cron error', { error })
    return serverError('Failed to sync Shopify comments')
  }
}
