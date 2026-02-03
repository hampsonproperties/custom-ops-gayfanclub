import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

/**
 * Nightly cron job to recalculate follow-up dates for all open work items
 * This ensures follow-ups stay current as event dates approach
 * Also updates rush_order and missed_design_window flags
 *
 * Security: Requires CRON_SECRET authorization header
 */
export async function GET(request: Request) {
  try {
    // Verify authorization
    const authHeader = request.headers.get('authorization')
    const cronSecret = process.env.CRON_SECRET

    if (!cronSecret) {
      console.error('CRON_SECRET not configured')
      return NextResponse.json(
        { error: 'Cron secret not configured' },
        { status: 500 }
      )
    }

    if (authHeader !== `Bearer ${cronSecret}`) {
      console.error('Unauthorized cron request')
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Use service role key for cron job
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // Call recalculate function
    const { data, error } = await supabase.rpc('recalculate_all_follow_ups')

    if (error) {
      console.error('Error recalculating follow-ups:', error)
      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      )
    }

    // Log results
    const updated = data?.length || 0
    console.log(`Recalculated follow-ups for ${updated} work items`)

    return NextResponse.json({
      success: true,
      updated: updated,
      timestamp: new Date().toISOString(),
      changes: data || []
    })
  } catch (error) {
    console.error('Cron job error:', error)
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Failed to recalculate follow-ups',
      },
      { status: 500 }
    )
  }
}
