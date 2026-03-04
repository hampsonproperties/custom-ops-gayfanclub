/**
 * Shopify Order Comment Sync
 *
 * Syncs comments from Shopify order timeline to work_item_notes.
 * Uses batch operations instead of per-comment queries (N+1 fix).
 */

import { SupabaseClient } from '@supabase/supabase-js'
import { fetchOrderComments } from '@/lib/shopify/fetch-order-comments'
import { logger } from '@/lib/logger'

const log = logger('shopify-comment-sync')

interface OrderComment {
  id: string
  message: string
  author: string
  created_at: string
}

/**
 * Syncs Shopify order comments to work_item_notes.
 *
 * Fetches all comments for the order, then batch-checks which ones already
 * exist (single query) and batch-inserts the new ones (single query).
 * This replaces the old per-comment check-then-insert loop.
 *
 * @returns Number of new comments synced
 */
export async function syncOrderComments(
  supabase: SupabaseClient,
  shopifyOrderId: string,
  workItemId: string
): Promise<number> {
  try {
    const comments = await fetchOrderComments(shopifyOrderId)
    if (comments.length === 0) return 0

    // Batch fetch: get all existing comment external_ids in one query
    const { data: existingNotes } = await supabase
      .from('work_item_notes')
      .select('external_id')
      .eq('work_item_id', workItemId)
      .eq('source', 'shopify_comment')

    const existingIds = new Set((existingNotes || []).map((n: any) => n.external_id))

    // Filter to only new comments
    const newComments = comments.filter((c: OrderComment) => !existingIds.has(c.id))

    if (newComments.length === 0) return 0

    // Batch insert all new comments in one query
    await supabase.from('work_item_notes').insert(
      newComments.map((comment: OrderComment) => ({
        work_item_id: workItemId,
        content: `[${comment.author}] ${comment.message}`,
        author_email: 'shopify-sync@system',
        source: 'shopify_comment',
        external_id: comment.id,
        synced_at: comment.created_at,
      }))
    )

    log.info('Synced new comments for order', { count: newComments.length, shopifyOrderId })
    return newComments.length
  } catch (error) {
    log.error('Error syncing comments', { error })
    return 0
  }
}
