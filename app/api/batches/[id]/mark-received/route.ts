import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { queueBatchEmailsForWorkItem } from '@/lib/email/batch-emails'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: batchId } = await params
    const body = await request.json()
    const { receivedAt } = body

    if (!batchId) {
      return NextResponse.json({ error: 'Missing batch ID' }, { status: 400 })
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // Get batch to verify it exists
    const { data: batch, error: batchError } = await supabase
      .from('batches')
      .select('id, name')
      .eq('id', batchId)
      .single()

    if (batchError || !batch) {
      return NextResponse.json({ error: 'Batch not found' }, { status: 404 })
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
      console.error('Failed to update batch:', updateError)
      return NextResponse.json({ error: 'Failed to update batch' }, { status: 500 })
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

    // Queue "arrived_stateside" emails for all work items (5-minute delay)
    const scheduledSendAt = new Date()
    scheduledSendAt.setMinutes(scheduledSendAt.getMinutes() + 5)

    let totalQueued = 0
    const allErrors: string[] = []

    for (const item of batchItems || []) {
      const result = await queueBatchEmailsForWorkItem({
        batchId,
        workItemId: item.work_item_id,
        emailType: 'arrived_stateside',
        scheduledSendAt,
        expectedBatchStatus: undefined, // No status check needed
        expectedHasTracking: false, // No tracking check needed
      })

      totalQueued += result.queued
      allErrors.push(...result.errors)
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
    console.error('Mark batch received error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to mark batch as received' },
      { status: 500 }
    )
  }
}
