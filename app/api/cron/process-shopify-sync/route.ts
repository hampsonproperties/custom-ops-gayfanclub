/**
 * Cron Job: Process Shopify Sync Queue
 *
 * GET /api/cron/process-shopify-sync
 *
 * Processes pending sync queue items
 * Runs every 5 minutes via Vercel Cron
 *
 * Security: Requires CRON_SECRET in Authorization header
 */

import { NextRequest, NextResponse } from 'next/server'
import { processSyncQueue } from '@/lib/shopify/sync/sync-queue-processor'
import { unauthorized, serverError } from '@/lib/api/errors'
import { logger } from '@/lib/logger'

const log = logger('cron-shopify-sync')

export async function GET(request: NextRequest) {
  try {
    // Verify cron secret for security
    const authHeader = request.headers.get('authorization')
    const expectedAuth = `Bearer ${process.env.CRON_SECRET}`

    if (!process.env.CRON_SECRET) {
      log.error('CRON_SECRET not configured')
      return serverError('Cron secret not configured')
    }

    if (authHeader !== expectedAuth) {
      log.error('Unauthorized cron request')
      return unauthorized('Unauthorized')
    }

    // Process sync queue
    log.info('Processing Shopify sync queue')
    const result = await processSyncQueue(50) // Process up to 50 items

    log.info('Sync queue processing complete', { processed: result.processed, succeeded: result.succeeded, failed: result.failed })

    if (result.errors.length > 0) {
      log.error('Sync queue errors', { errors: result.errors })
    }

    return NextResponse.json({
      success: true,
      processed: result.processed,
      succeeded: result.succeeded,
      failed: result.failed,
      errors: result.errors,
    })
  } catch (error) {
    log.error('Error processing sync queue', { error })
    return NextResponse.json(
      {
        error: 'Failed to process sync queue',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}
