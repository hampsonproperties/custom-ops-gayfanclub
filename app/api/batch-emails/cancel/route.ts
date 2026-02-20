import { NextRequest, NextResponse } from 'next/server'
import { cancelBatchEmail } from '@/lib/email/batch-emails'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { queueId, reason } = body

    if (!queueId) {
      return NextResponse.json({ error: 'Missing required field: queueId' }, { status: 400 })
    }

    const result = await cancelBatchEmail(queueId, reason || 'Manual cancellation')

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 400 })
    }

    return NextResponse.json({
      success: true,
      message: 'Email cancelled successfully',
    })
  } catch (error) {
    console.error('Cancel batch email error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to cancel batch email' },
      { status: 500 }
    )
  }
}
