/**
 * Recalculate All Customer Aggregates
 * Calls the existing update_customer_aggregates() DB function for every customer,
 * fixing any drift between stored total_spent/total_orders and actual order sums.
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { requireAuth } from '@/lib/api/require-auth'
import { logger } from '@/lib/logger'
import { serverError, tooManyRequests } from '@/lib/api/errors'

const log = logger('data-health-recalculate')

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

// Rate limit: 1 recalculation per hour
const lastRun = new Map<string, number>()
const COOLDOWN_MS = 60 * 60 * 1000

export async function POST(request: NextRequest) {
  try {
    const auth = await requireAuth()
    if (auth.response) return auth.response

    // Rate limit check
    const lastRunTime = lastRun.get('global') ?? 0
    const elapsed = Date.now() - lastRunTime
    if (elapsed < COOLDOWN_MS) {
      const resetIn = Math.ceil((COOLDOWN_MS - elapsed) / 1000)
      return tooManyRequests('Aggregate recalculation can only run once per hour', resetIn)
    }

    lastRun.set('global', Date.now())
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    log.info('Starting aggregate recalculation', { userId: auth.user.id })

    // Use the DB function that loops through all customers
    const { data, error } = await supabase.rpc('recalculate_all_customer_aggregates')

    if (error) {
      log.error('Aggregate recalculation failed', { error })
      lastRun.delete('global') // Allow retry on failure
      return serverError('Failed to recalculate aggregates: ' + error.message)
    }

    const recalculated = data?.[0]?.recalculated_count ?? 0
    log.info('Aggregate recalculation complete', { recalculated })

    return NextResponse.json({
      success: true,
      recalculated,
    })
  } catch (error: any) {
    log.error('Aggregate recalculation error', { error })
    lastRun.delete('global')
    return serverError('An error occurred during aggregate recalculation')
  }
}
