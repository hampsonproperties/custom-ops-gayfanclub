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

export async function GET(request: NextRequest) {
  try {
    // Verify cron secret for security
    const authHeader = request.headers.get('authorization')
    const expectedAuth = `Bearer ${process.env.CRON_SECRET}`

    if (!process.env.CRON_SECRET) {
      console.error('CRON_SECRET not configured')
      return NextResponse.json(
        { error: 'Cron secret not configured' },
        { status: 500 }
      )
    }

    if (authHeader !== expectedAuth) {
      console.error('Unauthorized cron request')
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Process sync queue
    console.log('[Cron] Processing Shopify sync queue...')
    const result = await processSyncQueue(50) // Process up to 50 items

    console.log(
      `[Cron] Processed ${result.processed} items: ${result.succeeded} succeeded, ${result.failed} failed`
    )

    if (result.errors.length > 0) {
      console.error('[Cron] Errors:', result.errors)
    }

    return NextResponse.json({
      success: true,
      processed: result.processed,
      succeeded: result.succeeded,
      failed: result.failed,
      errors: result.errors,
    })
  } catch (error) {
    console.error('[Cron] Error processing sync queue:', error)
    return NextResponse.json(
      {
        error: 'Failed to process sync queue',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}
