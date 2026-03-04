import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { queueBatchEmail, getBatchWorkItemRecipients } from '@/lib/email/batch-emails'
import { badRequest, notFound, serverError } from '@/lib/api/errors'
import { logger } from '@/lib/logger'

const log = logger('batch-queue-progress-emails')


/**
 * Queue Email 1 (entering_production) and Email 2 (midway_checkin) for all work items in a batch
 * This is called after a batch is confirmed
 */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: batchId } = await params

    if (!batchId) {
      return badRequest('Missing batch ID')
    }

    const supabase = await createClient()

    // Get batch to verify it exists and is confirmed
    const { data: batch, error: batchError } = await supabase
      .from('batches')
      .select('id, name, status')
      .eq('id', batchId)
      .single()

    if (batchError || !batch) {
      return notFound('Batch not found')
    }

    if (batch.status !== 'confirmed') {
      return badRequest('Batch must be confirmed before queueing progress emails')
    }

    // Get all work items in the batch
    const { data: batchItems, error: itemsError } = await supabase
      .from('batch_items')
      .select('work_item_id')
      .eq('batch_id', batchId)

    if (itemsError) {
      log.error('Failed to get batch items', { error: itemsError })
      return serverError('Failed to get batch items')
    }

    let totalQueuedEmail1 = 0
    let totalQueuedEmail2 = 0
    const allErrors: string[] = []

    // Queue Email 1 (entering_production) - 1 day after confirmation
    const email1ScheduledAt = new Date()
    email1ScheduledAt.setDate(email1ScheduledAt.getDate() + 1)

    // Queue Email 2 (midway_checkin) - 10 days after confirmation
    const email2ScheduledAt = new Date()
    email2ScheduledAt.setDate(email2ScheduledAt.getDate() + 10)

    // Pre-fetch all recipients in a single query (instead of N queries in the loop)
    const workItemIds = (batchItems || []).map(i => i.work_item_id)
    const recipientsMap = await getBatchWorkItemRecipients(workItemIds)

    for (const item of batchItems || []) {
      const recipients = recipientsMap.get(item.work_item_id)
      if (!recipients?.primaryEmail) continue

      const allEmails = [recipients.primaryEmail, ...recipients.alternateEmails]

      for (const email of allEmails) {
        // Queue Email 1
        const result1 = await queueBatchEmail({
          batchId,
          workItemId: item.work_item_id,
          emailType: 'entering_production',
          recipientEmail: email,
          recipientName: recipients.customerName || undefined,
          scheduledSendAt: email1ScheduledAt,
          expectedBatchStatus: 'confirmed',
        })
        if (result1.success) totalQueuedEmail1++
        else if (result1.error && !result1.error.includes('Already')) {
          allErrors.push(`Email 1 (${email}): ${result1.error}`)
        }

        // Queue Email 2
        const result2 = await queueBatchEmail({
          batchId,
          workItemId: item.work_item_id,
          emailType: 'midway_checkin',
          recipientEmail: email,
          recipientName: recipients.customerName || undefined,
          scheduledSendAt: email2ScheduledAt,
          expectedBatchStatus: 'confirmed',
        })
        if (result2.success) totalQueuedEmail2++
        else if (result2.error && !result2.error.includes('Already')) {
          allErrors.push(`Email 2 (${email}): ${result2.error}`)
        }
      }
    }

    return NextResponse.json({
      success: true,
      message: 'Progress emails queued successfully',
      batchId,
      email1Queued: totalQueuedEmail1,
      email1ScheduledFor: email1ScheduledAt.toISOString(),
      email2Queued: totalQueuedEmail2,
      email2ScheduledFor: email2ScheduledAt.toISOString(),
      errors: allErrors.length > 0 ? allErrors : undefined,
    })
  } catch (error) {
    log.error('Queue progress emails error', { error })
    return serverError(error instanceof Error ? error.message : 'Failed to queue progress emails')
  }
}
