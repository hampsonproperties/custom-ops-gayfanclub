import { NextRequest, NextResponse } from 'next/server'
import { cancelBatchEmail } from '@/lib/email/batch-emails'
import { validateBody } from '@/lib/api/validate'
import { cancelBatchEmailBody } from '@/lib/api/schemas'
import { badRequest, serverError } from '@/lib/api/errors'
import { logger } from '@/lib/logger'

const log = logger('batch-email-cancel')

export async function POST(request: NextRequest) {
  try {
    const bodyResult = validateBody(await request.json(), cancelBatchEmailBody)
    if (bodyResult.error) return bodyResult.error
    const { queueId, reason } = bodyResult.data

    const result = await cancelBatchEmail(queueId, reason || 'Manual cancellation')

    if (!result.success) {
      return badRequest(result.error || 'Failed to cancel email')
    }

    return NextResponse.json({
      success: true,
      message: 'Email cancelled successfully',
    })
  } catch (error) {
    log.error('Cancel batch email error', { error })
    return serverError(error instanceof Error ? error.message : 'Failed to cancel batch email')
  }
}
