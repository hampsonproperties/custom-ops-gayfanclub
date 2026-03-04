import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { notFound, serverError } from '@/lib/api/errors'
import { logger } from '@/lib/logger'

const log = logger('work-items-toggle-waiting')

/**
 * Toggle waiting status for a work item
 * When waiting = true, sets next_follow_up_at to null (pauses follow-up)
 * When waiting = false, recalculates next_follow_up_at
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const supabase = await createClient()
    const workItemId = id

    // Get current waiting state
    const { data: workItem, error: fetchError } = await supabase
      .from('work_items')
      .select('is_waiting')
      .eq('id', workItemId)
      .single()

    if (fetchError || !workItem) {
      log.error('Error fetching work item', { error: fetchError })
      return notFound('Work item not found')
    }

    const newState = !workItem.is_waiting

    // Update waiting flag
    const { error: updateError } = await supabase
      .from('work_items')
      .update({
        is_waiting: newState,
        next_follow_up_at: newState ? null : undefined  // Clear follow-up when waiting
      })
      .eq('id', workItemId)

    if (updateError) {
      log.error('Error toggling waiting', { error: updateError })
      return serverError(updateError.message)
    }

    // If resuming (newState = false), recalculate follow-up
    let nextFollowUp = null
    if (!newState) {
      const { data: calculatedFollowUp, error: calcError } = await supabase
        .rpc('calculate_next_follow_up', { work_item_id: workItemId })

      if (calcError) {
        log.error('Error calculating follow-up', { error: calcError })
      } else {
        nextFollowUp = calculatedFollowUp

        // Apply calculated follow-up
        await supabase
          .from('work_items')
          .update({ next_follow_up_at: nextFollowUp })
          .eq('id', workItemId)
      }
    }

    return NextResponse.json({
      success: true,
      is_waiting: newState,
      next_follow_up_at: nextFollowUp
    })
  } catch (error) {
    log.error('Toggle waiting error', { error })
    return serverError(error instanceof Error ? error.message : 'Failed to toggle waiting')
  }
}
