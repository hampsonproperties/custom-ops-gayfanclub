import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { serverError } from '@/lib/api/errors'
import { logger } from '@/lib/logger'

const log = logger('work-items-mark-followed-up')

/**
 * Mark a work item as followed up
 * Updates last_contact_at and recalculates next_follow_up_at
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const supabase = await createClient()
    const now = new Date().toISOString()
    const workItemId = id

    // Update last_contact_at
    const { error: updateError } = await supabase
      .from('work_items')
      .update({ last_contact_at: now })
      .eq('id', workItemId)

    if (updateError) {
      log.error('Error updating last_contact_at', { error: updateError })
      return serverError(updateError.message)
    }

    // Recalculate next_follow_up_at using the database function
    const { data: nextFollowUp, error: calcError } = await supabase
      .rpc('calculate_next_follow_up', { work_item_id: workItemId })

    if (calcError) {
      log.error('Error calculating follow-up', { error: calcError })
      return serverError(calcError.message)
    }

    // Apply calculated follow-up date
    const { error: applyError } = await supabase
      .from('work_items')
      .update({ next_follow_up_at: nextFollowUp })
      .eq('id', workItemId)

    if (applyError) {
      log.error('Error applying follow-up', { error: applyError })
      return serverError(applyError.message)
    }

    return NextResponse.json({
      success: true,
      next_follow_up_at: nextFollowUp,
      last_contact_at: now
    })
  } catch (error) {
    log.error('Mark followed up error', { error })
    return serverError(error instanceof Error ? error.message : 'Failed to mark followed up')
  }
}
