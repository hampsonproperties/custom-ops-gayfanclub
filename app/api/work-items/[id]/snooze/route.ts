import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { validateBody, validateParams } from '@/lib/api/validate'
import { snoozeBody, idParams } from '@/lib/api/schemas'
import { serverError } from '@/lib/api/errors'
import { logger } from '@/lib/logger'

const log = logger('work-items-snooze')

/**
 * Snooze a work item's follow-up for a specified number of days
 * Sets next_follow_up_at to current time + days
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const paramResult = validateParams(await params, idParams)
    if (paramResult.error) return paramResult.error
    const workItemId = paramResult.data.id

    const supabase = await createClient()

    const bodyResult = validateBody(await request.json(), snoozeBody)
    if (bodyResult.error) return bodyResult.error
    const { days } = bodyResult.data

    // Calculate snooze until date
    const snoozeUntil = new Date()
    snoozeUntil.setDate(snoozeUntil.getDate() + days)

    // Update next_follow_up_at
    const { error } = await supabase
      .from('work_items')
      .update({ next_follow_up_at: snoozeUntil.toISOString() })
      .eq('id', workItemId)

    if (error) {
      log.error('Error snoozing follow-up', { error })
      return serverError(error.message)
    }

    return NextResponse.json({
      success: true,
      snoozed_until: snoozeUntil.toISOString(),
      days: days
    })
  } catch (error) {
    log.error('Snooze error', { error })
    return serverError(error instanceof Error ? error.message : 'Failed to snooze follow-up')
  }
}
