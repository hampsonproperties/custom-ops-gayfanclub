/**
 * Shopify Sync Queue Processor
 *
 * Processes pending sync queue items with retry logic
 * Implements exponential backoff for failed syncs
 */

import { createClient } from '@supabase/supabase-js'
import {
  pushNoteToShopify,
  pushTagsToShopify,
  pushFulfillmentToShopify,
  pushMetafieldToShopify,
} from './push-to-shopify'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

interface ProcessResult {
  processed: number
  succeeded: number
  failed: number
  errors: string[]
}

interface SyncQueueItem {
  id: string
  sync_type: 'customer_note' | 'customer_tags' | 'order_fulfillment' | 'order_metafield'
  shopify_resource_type: 'customer' | 'order' | 'fulfillment'
  shopify_resource_id: string
  sync_payload: any
  retry_count: number
  max_retries: number
}

/**
 * Process sync queue items
 *
 * Fetches pending items and processes them with retry logic
 *
 * @param limit - Maximum number of items to process
 * @returns Processing results with counts
 */
export async function processSyncQueue(limit: number = 50): Promise<ProcessResult> {
  const supabase = createClient(supabaseUrl, supabaseServiceKey)

  const result: ProcessResult = {
    processed: 0,
    succeeded: 0,
    failed: 0,
    errors: [],
  }

  try {
    // 1. Fetch pending items (status='pending', next_retry_at <= NOW or NULL)
    const { data: items, error: fetchError } = await supabase
      .from('shopify_sync_queue')
      .select('*')
      .eq('status', 'pending')
      .or('next_retry_at.is.null,next_retry_at.lte.' + new Date().toISOString())
      .order('created_at', { ascending: true })
      .limit(limit)

    if (fetchError) {
      result.errors.push(`Failed to fetch queue items: ${fetchError.message}`)
      return result
    }

    if (!items || items.length === 0) {
      return result // No items to process
    }

    // 2. Process each item
    for (const item of items as SyncQueueItem[]) {
      result.processed++

      // Mark as processing
      await supabase
        .from('shopify_sync_queue')
        .update({
          status: 'processing',
          last_retry_at: new Date().toISOString(),
        })
        .eq('id', item.id)

      try {
        // Call appropriate push function based on sync_type
        const pushResult = await processSyncItem(item)

        if (pushResult.success) {
          // Mark as completed
          await supabase
            .from('shopify_sync_queue')
            .update({
              status: 'completed',
              completed_at: new Date().toISOString(),
              shopify_response: pushResult.response,
              error_message: null,
              error_code: null,
            })
            .eq('id', item.id)

          result.succeeded++
        } else {
          // Handle failure
          await handleFailure(supabase, item, pushResult.error || 'Unknown error')
          result.failed++
          result.errors.push(`Item ${item.id}: ${pushResult.error}`)
        }
      } catch (error) {
        // Handle unexpected errors
        const errorMessage = error instanceof Error ? error.message : 'Unexpected error'
        await handleFailure(supabase, item, errorMessage)
        result.failed++
        result.errors.push(`Item ${item.id}: ${errorMessage}`)
      }
    }

    return result
  } catch (error) {
    result.errors.push(
      error instanceof Error ? error.message : 'Unknown error in processSyncQueue'
    )
    return result
  }
}

/**
 * Process a single sync item
 *
 * Calls the appropriate Shopify API function based on sync_type
 *
 * @param item - Sync queue item
 * @returns Push result
 */
async function processSyncItem(item: SyncQueueItem): Promise<{ success: boolean; error?: string; response?: any }> {
  switch (item.sync_type) {
    case 'customer_note':
      return await pushNoteToShopify(
        item.shopify_resource_id,
        item.sync_payload.note
      )

    case 'customer_tags':
      return await pushTagsToShopify(
        item.shopify_resource_id,
        item.sync_payload.tags
      )

    case 'order_fulfillment':
      return await pushFulfillmentToShopify(
        item.shopify_resource_id,
        item.sync_payload
      )

    case 'order_metafield':
      return await pushMetafieldToShopify(
        item.shopify_resource_type as 'customer' | 'order',
        item.shopify_resource_id,
        item.sync_payload
      )

    default:
      return {
        success: false,
        error: `Unknown sync_type: ${item.sync_type}`,
      }
  }
}

/**
 * Handle sync failure with retry logic
 *
 * Increments retry count and calculates next retry time
 * Marks as failed if max retries exceeded
 *
 * @param supabase - Supabase client
 * @param item - Sync queue item
 * @param errorMessage - Error message
 */
async function handleFailure(
  supabase: any,
  item: SyncQueueItem,
  errorMessage: string
): Promise<void> {
  const newRetryCount = item.retry_count + 1

  if (newRetryCount >= item.max_retries) {
    // Max retries exceeded - mark as failed
    await supabase
      .from('shopify_sync_queue')
      .update({
        status: 'failed',
        retry_count: newRetryCount,
        error_message: errorMessage,
        completed_at: new Date().toISOString(),
      })
      .eq('id', item.id)
  } else {
    // Calculate next retry time with exponential backoff
    const nextRetryAt = calculateNextRetry(newRetryCount)

    await supabase
      .from('shopify_sync_queue')
      .update({
        status: 'pending',
        retry_count: newRetryCount,
        next_retry_at: nextRetryAt.toISOString(),
        error_message: errorMessage,
      })
      .eq('id', item.id)
  }
}

/**
 * Calculate next retry time with exponential backoff
 *
 * Delay schedule: 5min, 15min, 45min, 2hr, 6hr
 *
 * @param retryCount - Current retry count
 * @returns Next retry timestamp
 */
function calculateNextRetry(retryCount: number): Date {
  // Exponential backoff: 5min, 15min, 45min, 2hr, 6hr
  const delaysMinutes = [5, 15, 45, 120, 360]
  const delayMinutes = delaysMinutes[Math.min(retryCount, delaysMinutes.length - 1)]
  return new Date(Date.now() + delayMinutes * 60 * 1000)
}
