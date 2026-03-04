/**
 * Shopify Fulfillment Processor
 *
 * Handles fulfillments/create and orders/fulfilled webhook events.
 * Marks work items as shipped and recalculates follow-up dates.
 */

import { SupabaseClient } from '@supabase/supabase-js'
import { logger } from '@/lib/logger'

const log = logger('shopify-fulfillment')

/**
 * Process a Shopify fulfillment webhook.
 * Marks matching work items as shipped and pauses follow-ups.
 */
export async function processFulfillment(
  supabase: SupabaseClient,
  fulfillment: any,
  webhookEventId: string
): Promise<void> {
  const orderId = fulfillment.order_id?.toString()

  if (!orderId) {
    await supabase
      .from('webhook_events')
      .update({
        processing_status: 'failed',
        processing_error: 'Missing order_id in fulfillment payload',
      })
      .eq('id', webhookEventId)
    return
  }

  // Get work items for this order
  const { data: workItems } = await supabase
    .from('work_items')
    .select('id')
    .eq('shopify_order_id', orderId)

  // Update work item status to shipped
  const { error: updateError } = await supabase
    .from('work_items')
    .update({
      status: 'shipped',
      shopify_fulfillment_status: 'fulfilled',
    })
    .eq('shopify_order_id', orderId)

  if (updateError) {
    throw new Error(`Failed to update work item: ${updateError.message}`)
  }

  // Recalculate follow-ups (shipped items should pause follow-ups)
  if (workItems && workItems.length > 0) {
    try {
      for (const workItem of workItems) {
        const { data: nextFollowUp } = await supabase
          .rpc('calculate_next_follow_up', { work_item_id: workItem.id })

        if (nextFollowUp !== undefined) {
          await supabase
            .from('work_items')
            .update({ next_follow_up_at: nextFollowUp })
            .eq('id', workItem.id)
        }
      }
    } catch (followUpError) {
      log.error('Error calculating follow-ups', { error: followUpError })
    }
  }

  // Mark webhook as completed
  await supabase
    .from('webhook_events')
    .update({
      processing_status: 'completed',
      processed_at: new Date().toISOString(),
    })
    .eq('id', webhookEventId)
}
