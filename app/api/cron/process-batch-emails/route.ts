import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import {
  verifyEmailConditions,
  sendBatchEmail,
  markQueueItemSent,
  markQueueItemFailed,
  cancelBatchEmail,
} from '@/lib/email/batch-emails'
import { addToDLQ } from '@/lib/utils/dead-letter-queue'
import { unauthorized, serverError } from '@/lib/api/errors'
import { logger } from '@/lib/logger'
import { getAutoEmailsEnabled } from '@/lib/settings/auto-emails'

const log = logger('cron-batch-emails')

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

export async function GET(request: NextRequest) {
  try {
    // Verify cron secret
    const authHeader = request.headers.get('authorization')
    const cronSecret = process.env.CRON_SECRET

    if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
      return unauthorized('Unauthorized')
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // Check global auto-email toggle (defaults to OFF)
    const autoEmailsEnabled = await getAutoEmailsEnabled(supabase)
    if (!autoEmailsEnabled) {
      log.info('Auto emails disabled — skipping batch email processing')
      return NextResponse.json({ success: true, skipped: true, reason: 'auto_emails_disabled' })
    }

    // Find emails ready to send (scheduled_send_at <= NOW, status = 'pending')
    const { data: pendingEmails, error: fetchError } = await supabase
      .from('batch_email_queue')
      .select('*')
      .eq('status', 'pending')
      .lte('scheduled_send_at', new Date().toISOString())
      .limit(50) // Process max 50 emails per run

    if (fetchError) {
      log.error('Failed to fetch pending emails', { error: fetchError })
      return serverError('Failed to fetch pending emails')
    }

    const results = {
      processed: 0,
      sent: 0,
      cancelled: 0,
      failed: 0,
      skipped: 0,
      errors: [] as string[],
    }

    for (const queueItem of pendingEmails || []) {
      results.processed++

      try {
        // STEP 1: Verify conditions still match
        const verification = await verifyEmailConditions(queueItem.id)

        if (!verification.valid) {
          // Cancel the email
          await cancelBatchEmail(queueItem.id, verification.reason || 'Conditions changed')
          results.cancelled++
          log.info('Cancelled email', { queueItemId: queueItem.id, reason: verification.reason })
          continue
        }

        // STEP 2: Check for duplicate send
        const { data: alreadySent } = await supabase
          .from('batch_email_sends')
          .select('id')
          .eq('batch_id', queueItem.batch_id)
          .eq('work_item_id', queueItem.work_item_id)
          .eq('email_type', queueItem.email_type)
          .single()

        if (alreadySent) {
          await cancelBatchEmail(queueItem.id, 'Email already sent')
          results.skipped++
          log.info('Skipped duplicate email', { queueItemId: queueItem.id })
          continue
        }

        // STEP 3: Send the email
        const sendResult = await sendBatchEmail({
          queueItemId: queueItem.id,
          batchId: queueItem.batch_id,
          workItemId: queueItem.work_item_id,
          emailType: queueItem.email_type as 'entering_production' | 'midway_checkin' | 'en_route' | 'arrived_stateside',
          recipientEmail: queueItem.recipient_email,
          recipientName: queueItem.recipient_name || undefined,
        })

        if (sendResult.success) {
          // Mark as sent
          await markQueueItemSent(queueItem.id)
          results.sent++
          log.info('Sent email', { queueItemId: queueItem.id, recipientEmail: queueItem.recipient_email })
        } else {
          // Mark as failed in queue
          await markQueueItemFailed(queueItem.id, sendResult.error || 'Unknown error')
          results.failed++
          results.errors.push(`${queueItem.id}: ${sendResult.error}`)
          log.error('Failed to send email', { queueItemId: queueItem.id, error: sendResult.error })

          // Add to Dead Letter Queue for visibility and retry tracking
          await addToDLQ({
            operationType: 'email_send',
            operationKey: `batch_email:${queueItem.batch_id}:${queueItem.work_item_id}:${queueItem.email_type}`,
            errorMessage: sendResult.error || 'Unknown error',
            operationPayload: {
              queueItemId: queueItem.id,
              batchId: queueItem.batch_id,
              workItemId: queueItem.work_item_id,
              emailType: queueItem.email_type,
              recipientEmail: queueItem.recipient_email,
            },
            workItemId: queueItem.work_item_id,
          })
        }
      } catch (error) {
        // Mark as failed in queue
        const errorMessage = error instanceof Error ? error.message : 'Unknown error'
        const errorStack = error instanceof Error ? error.stack : undefined
        await markQueueItemFailed(queueItem.id, errorMessage)
        results.failed++
        results.errors.push(`${queueItem.id}: ${errorMessage}`)
        log.error('Error processing email', { queueItemId: queueItem.id, error })

        // Add to Dead Letter Queue for visibility and retry tracking
        await addToDLQ({
          operationType: 'email_send',
          operationKey: `batch_email:${queueItem.batch_id}:${queueItem.work_item_id}:${queueItem.email_type}`,
          errorMessage,
          errorStack,
          operationPayload: {
            queueItemId: queueItem.id,
            batchId: queueItem.batch_id,
            workItemId: queueItem.work_item_id,
            emailType: queueItem.email_type,
            recipientEmail: queueItem.recipient_email,
          },
          workItemId: queueItem.work_item_id,
        })
      }
    }

    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      ...results,
    })
  } catch (error) {
    log.error('Process batch emails cron error', { error })
    return serverError(error instanceof Error ? error.message : 'Failed to process batch emails')
  }
}
