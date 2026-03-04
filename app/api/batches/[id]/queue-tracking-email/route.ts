import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { queueBatchEmail, getBatchWorkItemRecipients } from '@/lib/email/batch-emails'
import { badRequest, notFound, serverError } from '@/lib/api/errors'
import { logger } from '@/lib/logger'

const log = logger('batch-queue-tracking-email')


/**
 * Queue Email 3 (en_route) for all work items in a batch
 * This is called after tracking number is added to the batch
 */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: batchId } = await params

    if (!batchId) {
      return badRequest('Missing batch ID')
    }

    const supabase = await createClient()

    // Get batch to verify it exists and has tracking
    const { data: batch, error: batchError } = await supabase
      .from('batches')
      .select('id, name, tracking_number')
      .eq('id', batchId)
      .single()

    if (batchError || !batch) {
      return notFound('Batch not found')
    }

    if (!batch.tracking_number) {
      return badRequest('Batch must have tracking number before queueing en route email')
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

    // Queue Email 3 (en_route) - 5 minutes after tracking added (verification delay)
    const scheduledSendAt = new Date()
    scheduledSendAt.setMinutes(scheduledSendAt.getMinutes() + 5)

    let totalQueued = 0
    const allErrors: string[] = []

    // Pre-fetch all recipients in a single query (instead of N queries in the loop)
    const workItemIds = (batchItems || []).map(i => i.work_item_id)
    const recipientsMap = await getBatchWorkItemRecipients(workItemIds)

    for (const item of batchItems || []) {
      const recipients = recipientsMap.get(item.work_item_id)
      if (!recipients?.primaryEmail) continue

      const allEmails = [recipients.primaryEmail, ...recipients.alternateEmails]

      for (const email of allEmails) {
        const result = await queueBatchEmail({
          batchId,
          workItemId: item.work_item_id,
          emailType: 'en_route',
          recipientEmail: email,
          recipientName: recipients.customerName || undefined,
          scheduledSendAt,
          expectedHasTracking: true,
        })
        if (result.success) totalQueued++
        else if (result.error && !result.error.includes('Already')) {
          allErrors.push(`(${email}): ${result.error}`)
        }
      }
    }

    return NextResponse.json({
      success: true,
      message: 'En route emails queued successfully',
      batchId,
      emailsQueued: totalQueued,
      scheduledFor: scheduledSendAt.toISOString(),
      errors: allErrors.length > 0 ? allErrors : undefined,
    })
  } catch (error) {
    log.error('Queue tracking email error', { error })
    return serverError(error instanceof Error ? error.message : 'Failed to queue tracking email')
  }
}
