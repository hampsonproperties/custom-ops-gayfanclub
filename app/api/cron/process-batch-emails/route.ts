import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'
import {
  verifyEmailConditions,
  sendBatchEmail,
  markQueueItemSent,
  markQueueItemFailed,
  cancelBatchEmail,
} from '@/lib/email/batch-emails'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

export async function GET(request: NextRequest) {
  try {
    // Verify cron secret
    const authHeader = request.headers.get('authorization')
    const cronSecret = process.env.CRON_SECRET

    if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const supabase = createClient<Database>(supabaseUrl, supabaseServiceKey)

    // Find emails ready to send (scheduled_send_at <= NOW, status = 'pending')
    const { data: pendingEmails, error: fetchError } = await supabase
      .from('batch_email_queue')
      .select('*')
      .eq('status', 'pending')
      .lte('scheduled_send_at', new Date().toISOString())
      .limit(50) // Process max 50 emails per run

    if (fetchError) {
      console.error('Failed to fetch pending emails:', fetchError)
      return NextResponse.json({ error: 'Failed to fetch pending emails' }, { status: 500 })
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
          console.log(`Cancelled email ${queueItem.id}: ${verification.reason}`)
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
          console.log(`Skipped duplicate email ${queueItem.id}`)
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
          console.log(`Sent email ${queueItem.id} to ${queueItem.recipient_email}`)
        } else {
          // Mark as failed
          await markQueueItemFailed(queueItem.id, sendResult.error || 'Unknown error')
          results.failed++
          results.errors.push(`${queueItem.id}: ${sendResult.error}`)
          console.error(`Failed to send email ${queueItem.id}:`, sendResult.error)
        }
      } catch (error) {
        // Mark as failed
        const errorMessage = error instanceof Error ? error.message : 'Unknown error'
        await markQueueItemFailed(queueItem.id, errorMessage)
        results.failed++
        results.errors.push(`${queueItem.id}: ${errorMessage}`)
        console.error(`Error processing email ${queueItem.id}:`, error)
      }
    }

    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      ...results,
    })
  } catch (error) {
    console.error('Process batch emails cron error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to process batch emails' },
      { status: 500 }
    )
  }
}
