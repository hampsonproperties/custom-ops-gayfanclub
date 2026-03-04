import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { queueBatchEmail, getBatchWorkItemRecipients } from '@/lib/email/batch-emails'
import { validateBody, validateParams } from '@/lib/api/validate'
import { markReceivedBody, idParams } from '@/lib/api/schemas'
import { notFound, serverError } from '@/lib/api/errors'
import { logger } from '@/lib/logger'

const log = logger('batch-mark-received')


export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const paramResult = validateParams(await params, idParams)
    if (paramResult.error) return paramResult.error
    const { id: batchId } = paramResult.data

    const bodyResult = validateBody(await request.json(), markReceivedBody)
    if (bodyResult.error) return bodyResult.error
    const { receivedAt } = bodyResult.data

    const supabase = await createClient()

    // Get batch to verify it exists
    const { data: batch, error: batchError } = await supabase
      .from('batches')
      .select('id, name')
      .eq('id', batchId)
      .single()

    if (batchError || !batch) {
      return notFound('Batch not found')
    }

    // Update batch with received_at_warehouse_at timestamp
    const receivedTimestamp = receivedAt ? new Date(receivedAt).toISOString() : new Date().toISOString()

    const { error: updateError } = await supabase
      .from('batches')
      .update({
        received_at_warehouse_at: receivedTimestamp,
      })
      .eq('id', batchId)

    if (updateError) {
      log.error('Failed to update batch', { error: updateError })
      return serverError('Failed to update batch')
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

    // Queue "arrived_stateside" emails for all work items (5-minute delay)
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
          emailType: 'arrived_stateside',
          recipientEmail: email,
          recipientName: recipients.customerName || undefined,
          scheduledSendAt,
        })
        if (result.success) totalQueued++
        else if (result.error && !result.error.includes('Already')) {
          allErrors.push(`(${email}): ${result.error}`)
        }
      }
    }

    return NextResponse.json({
      success: true,
      message: 'Batch marked as received at warehouse',
      batchId,
      receivedAt: receivedTimestamp,
      emailsQueued: totalQueued,
      errors: allErrors.length > 0 ? allErrors : undefined,
    })
  } catch (error) {
    log.error('Mark batch received error', { error })
    return serverError(error instanceof Error ? error.message : 'Failed to mark batch as received')
  }
}
