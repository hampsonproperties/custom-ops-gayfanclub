import { NextRequest, NextResponse } from 'next/server'
import { queueBatchEmail } from '@/lib/email/batch-emails'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()

    const {
      batchId,
      workItemId,
      emailType,
      recipientEmail,
      recipientName,
      scheduledSendAt,
      expectedBatchStatus,
      expectedHasTracking,
    } = body

    // Validate required fields
    if (!batchId || !workItemId || !emailType || !recipientEmail || !scheduledSendAt) {
      return NextResponse.json(
        { error: 'Missing required fields: batchId, workItemId, emailType, recipientEmail, scheduledSendAt' },
        { status: 400 }
      )
    }

    // Validate email type
    const validEmailTypes = ['entering_production', 'midway_checkin', 'en_route', 'arrived_stateside']
    if (!validEmailTypes.includes(emailType)) {
      return NextResponse.json(
        { error: `Invalid emailType. Must be one of: ${validEmailTypes.join(', ')}` },
        { status: 400 }
      )
    }

    // Queue the email
    const result = await queueBatchEmail({
      batchId,
      workItemId,
      emailType,
      recipientEmail,
      recipientName,
      scheduledSendAt: new Date(scheduledSendAt),
      expectedBatchStatus,
      expectedHasTracking,
    })

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 400 })
    }

    return NextResponse.json({
      success: true,
      message: 'Email queued successfully',
    })
  } catch (error) {
    console.error('Queue batch email error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to queue batch email' },
      { status: 500 }
    )
  }
}
