import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'
import { unauthorized, serverError } from '@/lib/api/errors'
import { logger } from '@/lib/logger'

const log = logger('cron-recalculate-follow-ups')

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
      log.error('CRON_SECRET not configured')
      return serverError('Cron secret not configured')
    }

    if (authHeader !== `Bearer ${cronSecret}`) {
      log.error('Unauthorized cron request')
      return unauthorized('Unauthorized')
    }

    // Use service role key for cron job
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // Call recalculate function
    const { data, error } = await supabase.rpc('recalculate_all_follow_ups')

    if (error) {
      log.error('Error recalculating follow-ups', { error })
      return serverError(error.message)
    }

    // Log results
    const updated = data?.length || 0
    log.info('Recalculated follow-ups', { updatedWorkItems: updated })

    return NextResponse.json({
      success: true,
      updated: updated,
      timestamp: new Date().toISOString(),
      changes: data || []
    })
  } catch (error) {
    log.error('Cron job error', { error })
    return serverError(error instanceof Error ? error.message : 'Failed to recalculate follow-ups')
  }
}
