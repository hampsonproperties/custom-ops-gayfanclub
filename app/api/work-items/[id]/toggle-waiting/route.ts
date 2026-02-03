import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

/**
 * Toggle waiting status for a work item
 * When waiting = true, sets next_follow_up_at to null (pauses follow-up)
 * When waiting = false, recalculates next_follow_up_at
 */
export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = await createClient()
    const workItemId = params.id

    // Get current waiting state
    const { data: workItem, error: fetchError } = await supabase
      .from('work_items')
      .select('is_waiting')
      .eq('id', workItemId)
      .single()

    if (fetchError || !workItem) {
      console.error('Error fetching work item:', fetchError)
      return NextResponse.json(
        { error: 'Work item not found' },
        { status: 404 }
      )
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
      console.error('Error toggling waiting:', updateError)
      return NextResponse.json(
        { error: updateError.message },
        { status: 500 }
      )
    }

    // If resuming (newState = false), recalculate follow-up
    let nextFollowUp = null
    if (!newState) {
      const { data: calculatedFollowUp, error: calcError } = await supabase
        .rpc('calculate_next_follow_up', { work_item_id: workItemId })

      if (calcError) {
        console.error('Error calculating follow-up:', calcError)
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
    console.error('Toggle waiting error:', error)
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Failed to toggle waiting',
      },
      { status: 500 }
    )
  }
}
