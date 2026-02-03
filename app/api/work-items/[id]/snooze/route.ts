import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

/**
 * Snooze a work item's follow-up for a specified number of days
 * Sets next_follow_up_at to current time + days
 */
export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = await createClient()
    const { days } = await request.json()
    const workItemId = params.id

    if (!days || typeof days !== 'number' || days <= 0) {
      return NextResponse.json(
        { error: 'Invalid days parameter. Must be a positive number.' },
        { status: 400 }
      )
    }

    // Calculate snooze until date
    const snoozeUntil = new Date()
    snoozeUntil.setDate(snoozeUntil.getDate() + days)

    // Update next_follow_up_at
    const { error } = await supabase
      .from('work_items')
      .update({ next_follow_up_at: snoozeUntil.toISOString() })
      .eq('id', workItemId)

    if (error) {
      console.error('Error snoozing follow-up:', error)
      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      snoozed_until: snoozeUntil.toISOString(),
      days: days
    })
  } catch (error) {
    console.error('Snooze error:', error)
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Failed to snooze follow-up',
      },
      { status: 500 }
    )
  }
}
