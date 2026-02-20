import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'
import { queueBatchEmailsForWorkItem } from '@/lib/email/batch-emails'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

/**
 * Queue Email 1 (entering_production) and Email 2 (midway_checkin) for all work items in a batch
 * This is called after a batch is confirmed
 */
export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const { id: batchId } = params

    if (!batchId) {
      return NextResponse.json({ error: 'Missing batch ID' }, { status: 400 })
    }

    const supabase = createClient<Database>(supabaseUrl, supabaseServiceKey)

    // Get batch to verify it exists and is confirmed
    const { data: batch, error: batchError } = await supabase
      .from('batches')
      .select('id, name, status')
      .eq('id', batchId)
      .single()

    if (batchError || !batch) {
      return NextResponse.json({ error: 'Batch not found' }, { status: 404 })
    }

    if (batch.status !== 'confirmed') {
      return NextResponse.json({ error: 'Batch must be confirmed before queueing progress emails' }, { status: 400 })
    }

    // Get all work items in the batch
    const { data: batchItems, error: itemsError } = await supabase
      .from('batch_items')
      .select('work_item_id')
      .eq('batch_id', batchId)

    if (itemsError) {
      console.error('Failed to get batch items:', itemsError)
      return NextResponse.json({ error: 'Failed to get batch items' }, { status: 500 })
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

    for (const item of batchItems || []) {
      // Queue Email 1
      const result1 = await queueBatchEmailsForWorkItem({
        batchId,
        workItemId: item.work_item_id,
        emailType: 'entering_production',
        scheduledSendAt: email1ScheduledAt,
        expectedBatchStatus: 'confirmed',
      })

      totalQueuedEmail1 += result1.queued
      allErrors.push(...result1.errors)

      // Queue Email 2
      const result2 = await queueBatchEmailsForWorkItem({
        batchId,
        workItemId: item.work_item_id,
        emailType: 'midway_checkin',
        scheduledSendAt: email2ScheduledAt,
        expectedBatchStatus: 'confirmed',
      })

      totalQueuedEmail2 += result2.queued
      allErrors.push(...result2.errors)
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
    console.error('Queue progress emails error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to queue progress emails' },
      { status: 500 }
    )
  }
}
