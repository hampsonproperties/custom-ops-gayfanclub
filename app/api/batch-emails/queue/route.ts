import { NextRequest, NextResponse } from 'next/server'
import { queueBatchEmail } from '@/lib/email/batch-emails'
import { validateBody } from '@/lib/api/validate'
import { queueBatchEmailBody } from '@/lib/api/schemas'
import { badRequest, serverError } from '@/lib/api/errors'
import { logger } from '@/lib/logger'

const log = logger('batch-email-queue')

export async function POST(request: NextRequest) {
  try {
    const bodyResult = validateBody(await request.json(), queueBatchEmailBody)
    if (bodyResult.error) return bodyResult.error
    const {
      batchId,
      workItemId,
      emailType,
      recipientEmail,
      recipientName,
      scheduledSendAt,
      expectedBatchStatus,
      expectedHasTracking,
    } = bodyResult.data

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
      return badRequest(result.error || 'Failed to queue email')
    }

    return NextResponse.json({
      success: true,
      message: 'Email queued successfully',
    })
  } catch (error) {
    log.error('Queue batch email error', { error })
    return serverError(error instanceof Error ? error.message : 'Failed to queue batch email')
  }
}
