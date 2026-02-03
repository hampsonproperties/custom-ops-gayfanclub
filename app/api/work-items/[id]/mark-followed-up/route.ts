import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

/**
 * Mark a work item as followed up
 * Updates last_contact_at and recalculates next_follow_up_at
 */
export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = await createClient()
    const now = new Date().toISOString()
    const workItemId = params.id

    // Update last_contact_at
    const { error: updateError } = await supabase
      .from('work_items')
      .update({ last_contact_at: now })
      .eq('id', workItemId)

    if (updateError) {
      console.error('Error updating last_contact_at:', updateError)
      return NextResponse.json(
        { error: updateError.message },
        { status: 500 }
      )
    }

    // Recalculate next_follow_up_at using the database function
    const { data: nextFollowUp, error: calcError } = await supabase
      .rpc('calculate_next_follow_up', { work_item_id: workItemId })

    if (calcError) {
      console.error('Error calculating follow-up:', calcError)
      return NextResponse.json(
        { error: calcError.message },
        { status: 500 }
      )
    }

    // Apply calculated follow-up date
    const { error: applyError } = await supabase
      .from('work_items')
      .update({ next_follow_up_at: nextFollowUp })
      .eq('id', workItemId)

    if (applyError) {
      console.error('Error applying follow-up:', applyError)
      return NextResponse.json(
        { error: applyError.message },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      next_follow_up_at: nextFollowUp,
      last_contact_at: now
    })
  } catch (error) {
    console.error('Mark followed up error:', error)
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Failed to mark followed up',
      },
      { status: 500 }
    )
  }
}
