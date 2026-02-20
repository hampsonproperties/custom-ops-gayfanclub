import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'
import { queueBatchEmailsForWorkItem } from '@/lib/email/batch-emails'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

/**
 * Queue Email 3 (en_route) for all work items in a batch
 * This is called after tracking number is added to the batch
 */
export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const { id: batchId } = params

    if (!batchId) {
      return NextResponse.json({ error: 'Missing batch ID' }, { status: 400 })
    }

    const supabase = createClient<Database>(supabaseUrl, supabaseServiceKey)

    // Get batch to verify it exists and has tracking
    const { data: batch, error: batchError } = await supabase
      .from('batches')
      .select('id, name, tracking_number')
      .eq('id', batchId)
      .single()

    if (batchError || !batch) {
      return NextResponse.json({ error: 'Batch not found' }, { status: 404 })
    }

    if (!batch.tracking_number) {
      return NextResponse.json({ error: 'Batch must have tracking number before queueing en route email' }, { status: 400 })
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

    // Queue Email 3 (en_route) - 5 minutes after tracking added (verification delay)
    const scheduledSendAt = new Date()
    scheduledSendAt.setMinutes(scheduledSendAt.getMinutes() + 5)

    let totalQueued = 0
    const allErrors: string[] = []

    for (const item of batchItems || []) {
      const result = await queueBatchEmailsForWorkItem({
        batchId,
        workItemId: item.work_item_id,
        emailType: 'en_route',
        scheduledSendAt,
        expectedHasTracking: true,
      })

      totalQueued += result.queued
      allErrors.push(...result.errors)
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
    console.error('Queue tracking email error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to queue tracking email' },
      { status: 500 }
    )
  }
}
