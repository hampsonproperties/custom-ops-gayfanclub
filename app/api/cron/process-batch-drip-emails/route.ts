import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'
import { queueBatchEmailsForWorkItem } from '@/lib/email/batch-emails'
import { unauthorized, serverError } from '@/lib/api/errors'
import { logger } from '@/lib/logger'
import { DRIP_EMAIL_SCHEDULE } from '@/lib/config'
import { getAutoEmailsEnabled } from '@/lib/settings/auto-emails'

const log = logger('cron-batch-drip-emails')

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

/**
 * Daily cron job to process batch drip email campaign
 * Phase 2: Automation & Discovery - Batch Drip Email Automation
 *
 * Email Schedule (from when Alibaba order number is added):
 * - Email 1: "Order in production" (Day 0 - immediate)
 * - Email 2: "Shipped from facility" (Day 7)
 * - Email 3: "Going through customs" (Day 14)
 * - Email 4: "Arrived at warehouse" (Day 21)
 *
 * Email 4 is skipped if Shopify fulfillment webhook fires (drip_email_4_skipped = true)
 *
 * Security: Requires CRON_SECRET authorization header
 */
export async function GET(request: Request) {
  try {
    // Verify authorization
    const authHeader = request.headers.get('authorization')
    const cronSecret = process.env.CRON_SECRET

    if (!cronSecret) {
      log.error('CRON_SECRET not configured')
      return serverError('Cron secret not configured')
    }

    if (authHeader !== `Bearer ${cronSecret}`) {
      log.error('Unauthorized cron request')
      return unauthorized('Unauthorized')
    }

    // Use service role key for cron job
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // Check global auto-email toggle (defaults to OFF)
    const autoEmailsEnabled = await getAutoEmailsEnabled(supabase)
    if (!autoEmailsEnabled) {
      log.info('Auto emails disabled — skipping drip email processing')
      return NextResponse.json({ success: true, skipped: true, reason: 'auto_emails_disabled' })
    }

    const results = {
      email1_queued: 0,
      email2_queued: 0,
      email3_queued: 0,
      email4_queued: 0,
      errors: [] as string[],
    }

    // ========================================================================
    // EMAIL 1: Order in Production (immediate when Alibaba # added)
    // ========================================================================
    const { data: batchesForEmail1, error: error1 } = await supabase
      .from('batches')
      .select('id, name, alibaba_order_number')
      .not('alibaba_order_number', 'is', null)
      .is('drip_email_1_sent_at', null)

    if (error1) {
      log.error('Error fetching batches for email 1', { error: error1 })
      results.errors.push(`Email 1 fetch error: ${error1.message}`)
    } else {
      for (const batch of batchesForEmail1 || []) {
        try {
          const queued = await queueDripEmail(supabase, batch, 1)
          results.email1_queued += queued
        } catch (error) {
          const msg = error instanceof Error ? error.message : 'Unknown error'
          results.errors.push(`Email 1 for batch ${batch.id}: ${msg}`)
        }
      }
    }

    // ========================================================================
    // EMAIL 2: Shipped from Facility (Day 7)
    // ========================================================================
    const sevenDaysAgo = new Date()
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - DRIP_EMAIL_SCHEDULE.email2_days)

    const { data: batchesForEmail2, error: error2 } = await supabase
      .from('batches')
      .select('id, name, alibaba_order_number, drip_email_1_sent_at')
      .not('alibaba_order_number', 'is', null)
      .not('drip_email_1_sent_at', 'is', null)
      .is('drip_email_2_sent_at', null)
      .lte('drip_email_1_sent_at', sevenDaysAgo.toISOString())

    if (error2) {
      log.error('Error fetching batches for email 2', { error: error2 })
      results.errors.push(`Email 2 fetch error: ${error2.message}`)
    } else {
      for (const batch of batchesForEmail2 || []) {
        try {
          const queued = await queueDripEmail(supabase, batch, 2)
          results.email2_queued += queued
        } catch (error) {
          const msg = error instanceof Error ? error.message : 'Unknown error'
          results.errors.push(`Email 2 for batch ${batch.id}: ${msg}`)
        }
      }
    }

    // ========================================================================
    // EMAIL 3: Going Through Customs (Day 14)
    // ========================================================================
    const fourteenDaysAgo = new Date()
    fourteenDaysAgo.setDate(fourteenDaysAgo.getDate() - DRIP_EMAIL_SCHEDULE.email3_days)

    const { data: batchesForEmail3, error: error3 } = await supabase
      .from('batches')
      .select('id, name, alibaba_order_number, drip_email_1_sent_at')
      .not('alibaba_order_number', 'is', null)
      .not('drip_email_1_sent_at', 'is', null)
      .is('drip_email_3_sent_at', null)
      .lte('drip_email_1_sent_at', fourteenDaysAgo.toISOString())

    if (error3) {
      log.error('Error fetching batches for email 3', { error: error3 })
      results.errors.push(`Email 3 fetch error: ${error3.message}`)
    } else {
      for (const batch of batchesForEmail3 || []) {
        try {
          const queued = await queueDripEmail(supabase, batch, 3)
          results.email3_queued += queued
        } catch (error) {
          const msg = error instanceof Error ? error.message : 'Unknown error'
          results.errors.push(`Email 3 for batch ${batch.id}: ${msg}`)
        }
      }
    }

    // ========================================================================
    // EMAIL 4: Arrived at Warehouse (Day 21)
    // Skipped if drip_email_4_skipped = true (Shopify already sent tracking)
    // ========================================================================
    const twentyOneDaysAgo = new Date()
    twentyOneDaysAgo.setDate(twentyOneDaysAgo.getDate() - DRIP_EMAIL_SCHEDULE.email4_days)

    const { data: batchesForEmail4, error: error4 } = await supabase
      .from('batches')
      .select('id, name, alibaba_order_number, drip_email_1_sent_at')
      .not('alibaba_order_number', 'is', null)
      .not('drip_email_1_sent_at', 'is', null)
      .is('drip_email_4_sent_at', null)
      .eq('drip_email_4_skipped', false)
      .lte('drip_email_1_sent_at', twentyOneDaysAgo.toISOString())

    if (error4) {
      log.error('Error fetching batches for email 4', { error: error4 })
      results.errors.push(`Email 4 fetch error: ${error4.message}`)
    } else {
      for (const batch of batchesForEmail4 || []) {
        try {
          const queued = await queueDripEmail(supabase, batch, 4)
          results.email4_queued += queued
        } catch (error) {
          const msg = error instanceof Error ? error.message : 'Unknown error'
          results.errors.push(`Email 4 for batch ${batch.id}: ${msg}`)
        }
      }
    }

    log.info('Batch drip email processing complete', { results })

    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      ...results,
    })
  } catch (error) {
    log.error('Batch drip email cron error', { error })
    return serverError(error instanceof Error ? error.message : 'Failed to process drip emails')
  }
}

/**
 * Map drip email numbers to batch email types used by the queue system.
 * This eliminates the parallel sending code — all emails flow through
 * the queue-based sendBatchEmail() which handles Microsoft Graph,
 * communications logging, and deduplication.
 */
const DRIP_TO_BATCH_EMAIL_TYPE: Record<1 | 2 | 3 | 4, 'entering_production' | 'midway_checkin' | 'en_route' | 'arrived_stateside'> = {
  1: 'entering_production',
  2: 'midway_checkin',
  3: 'en_route',
  4: 'arrived_stateside',
}

/**
 * Queue drip emails for a batch via the batch_email_queue system.
 * Returns the number of emails queued.
 *
 * The actual sending is handled by process-batch-emails cron (every 5 min),
 * which calls sendBatchEmail() with Microsoft Graph integration.
 */
async function queueDripEmail(
  supabase: any,
  batch: any,
  emailNumber: 1 | 2 | 3 | 4
): Promise<number> {
  const emailType = DRIP_TO_BATCH_EMAIL_TYPE[emailNumber]

  // Get all work items in this batch
  const { data: batchItems, error: batchItemsError } = await supabase
    .from('batch_items')
    .select('work_item_id')
    .eq('batch_id', batch.id)

  if (batchItemsError) {
    throw new Error(`Failed to fetch batch items: ${batchItemsError.message}`)
  }

  if (!batchItems || batchItems.length === 0) {
    log.info('No work items in batch, marking as processed', { batchId: batch.id })
    await updateDripEmailTimestamp(supabase, batch.id, emailNumber)
    return 0
  }

  // Schedule for immediate send (drip cron already determined it's time)
  const scheduledSendAt = new Date()

  let totalQueued = 0

  // Fetch suppress_drip_emails flag for all work items in this batch
  const workItemIds = batchItems.map((item: any) => item.work_item_id)
  const { data: workItems } = await supabase
    .from('work_items')
    .select('id, suppress_drip_emails')
    .in('id', workItemIds)

  const suppressedIds = new Set(
    (workItems || []).filter((wi: any) => wi.suppress_drip_emails).map((wi: any) => wi.id)
  )

  for (const item of batchItems) {
    // Skip work items with drip emails suppressed
    if (suppressedIds.has(item.work_item_id)) {
      log.info('Skipping suppressed work item', { workItemId: item.work_item_id, batchId: batch.id })
      continue
    }

    // queueBatchEmailsForWorkItem handles:
    // - Looking up customer email + alternates
    // - Dedup checking (already queued/sent)
    // - Inserting into batch_email_queue
    const result = await queueBatchEmailsForWorkItem({
      batchId: batch.id,
      workItemId: item.work_item_id,
      emailType,
      scheduledSendAt,
    })

    totalQueued += result.queued

    if (result.errors.length > 0) {
      log.error('Errors queueing for work item', { workItemId: item.work_item_id, errors: result.errors })
    }
  }

  log.info('Queued drip emails for batch', { totalQueued, batchName: batch.name, emailNumber, emailType })

  // Mark drip timestamp so this cron doesn't re-queue on next run
  await updateDripEmailTimestamp(supabase, batch.id, emailNumber)

  return totalQueued
}

/**
 * Update the drip_email_X_sent_at timestamp to prevent re-processing.
 */
async function updateDripEmailTimestamp(
  supabase: any,
  batchId: string,
  emailNumber: 1 | 2 | 3 | 4
): Promise<void> {
  const columnName = `drip_email_${emailNumber}_sent_at`

  const { error } = await supabase
    .from('batches')
    .update({ [columnName]: new Date().toISOString() })
    .eq('id', batchId)

  if (error) {
    throw new Error(`Failed to update ${columnName}: ${error.message}`)
  }
}
