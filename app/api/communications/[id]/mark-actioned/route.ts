import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { serverError } from '@/lib/api/errors'
import { logger } from '@/lib/logger'

const log = logger('communications-mark-actioned')

/**
 * Mark a communication (inbound email) as actioned
 * Sets actioned_at timestamp to indicate it's been handled
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const supabase = await createClient()
    const now = new Date().toISOString()
    const communicationId = id

    // Update actioned_at
    const { error } = await supabase
      .from('communications')
      .update({ actioned_at: now })
      .eq('id', communicationId)

    if (error) {
      log.error('Error marking communication as actioned', { error })
      return serverError(error.message)
    }

    return NextResponse.json({
      success: true,
      actioned_at: now
    })
  } catch (error) {
    log.error('Mark actioned error', { error })
    return serverError(error instanceof Error ? error.message : 'Failed to mark as actioned')
  }
}
