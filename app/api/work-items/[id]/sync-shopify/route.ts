/**
 * Sync Shopify Comments for a Work Item
 * Manually re-fetches timeline comments from Shopify and syncs any new ones.
 */

import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { requireAuth } from '@/lib/api/require-auth'
import { validateParams } from '@/lib/api/validate'
import { idParams } from '@/lib/api/schemas'
import { syncOrderComments } from '@/lib/shopify/processors/comment-sync'
import { serverError, notFound } from '@/lib/api/errors'
import { logger } from '@/lib/logger'

const log = logger('work-items-sync-shopify')

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireAuth()
    if (auth.response) return auth.response

    const paramResult = validateParams(await params, idParams)
    if (paramResult.error) return paramResult.error
    const workItemId = paramResult.data.id

    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // Get the work item's Shopify order IDs
    const { data: workItem, error: fetchError } = await supabase
      .from('work_items')
      .select('id, shopify_order_id, design_fee_order_id, shopify_order_number, design_fee_order_number')
      .eq('id', workItemId)
      .single()

    if (fetchError || !workItem) {
      return notFound('Work item not found')
    }

    // Sync comments from all linked Shopify orders
    let totalSynced = 0
    const orderIds: string[] = []

    if (workItem.shopify_order_id) orderIds.push(workItem.shopify_order_id)
    if (workItem.design_fee_order_id) orderIds.push(workItem.design_fee_order_id)

    if (orderIds.length === 0) {
      return NextResponse.json({ success: true, synced: 0, message: 'No Shopify orders linked' })
    }

    for (const orderId of orderIds) {
      const synced = await syncOrderComments(supabase, orderId, workItemId)
      totalSynced += synced
    }

    log.info('Manual Shopify comment sync', { workItemId, synced: totalSynced, orderIds })

    return NextResponse.json({
      success: true,
      synced: totalSynced,
    })
  } catch (error) {
    log.error('Sync Shopify error', { error })
    return serverError(error instanceof Error ? error.message : 'Failed to sync from Shopify')
  }
}
