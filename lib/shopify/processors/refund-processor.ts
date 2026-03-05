/**
 * Shopify Refund Processor
 *
 * Handles refunds/create webhook events.
 * Appends refund transactions to payment_history in both
 * work_items and customer_orders tables.
 */

import { SupabaseClient } from '@supabase/supabase-js'
import { logger } from '@/lib/logger'

const log = logger('shopify-refund-processor')

/**
 * Process a Shopify refund webhook.
 * Updates payment history for matching work items and customer orders.
 */
export async function processRefund(
  supabase: SupabaseClient,
  refund: any,
  webhookEventId: string
): Promise<void> {
  log.info('Processing refund', { refundId: refund.id })

  try {
    const orderId = refund.order_id?.toString()

    if (!orderId) {
      await supabase
        .from('webhook_events')
        .update({
          processing_status: 'failed',
          error_message: 'Missing order_id in refund payload',
        })
        .eq('id', webhookEventId)
      return
    }

    const refundTransactions = (refund.transactions || []).map((tx: any) => ({
      transaction_id: tx.id?.toString(),
      amount: tx.amount,
      currency: tx.currency,
      status: tx.status,
      kind: 'refund',
      gateway: tx.gateway,
      paid_at: tx.created_at,
    }))

    // Update work items
    await updateWorkItemPaymentHistory(supabase, orderId, refundTransactions)

    // Update customer orders
    await updateCustomerOrderPaymentHistory(supabase, orderId, refundTransactions)

    // Mark webhook as completed
    await supabase
      .from('webhook_events')
      .update({
        processing_status: 'completed',
        processed_at: new Date().toISOString(),
      })
      .eq('id', webhookEventId)
  } catch (error: any) {
    log.error('Error processing refund', { error })
    await supabase
      .from('webhook_events')
      .update({
        processing_status: 'failed',
        error_message: error.message,
      })
      .eq('id', webhookEventId)
    throw error
  }
}

async function updateWorkItemPaymentHistory(
  supabase: SupabaseClient,
  orderId: string,
  refundTransactions: any[]
): Promise<void> {
  const { data: workItems } = await supabase
    .from('work_items')
    .select('id, payment_history')
    .eq('shopify_order_id', orderId)

  if (!workItems || workItems.length === 0) return

  for (const workItem of workItems) {
    let paymentHistory: any[] = []
    if (workItem.payment_history) {
      try {
        paymentHistory = JSON.parse(workItem.payment_history as string)
      } catch (e) {
        log.error('Failed to parse payment_history', { error: e, workItemId: workItem.id })
      }
    }

    paymentHistory = [...paymentHistory, ...refundTransactions]

    await supabase
      .from('work_items')
      .update({ payment_history: JSON.stringify(paymentHistory) })
      .eq('id', workItem.id)

    log.info('Updated payment history with refund', { workItemId: workItem.id })
  }
}

async function updateCustomerOrderPaymentHistory(
  supabase: SupabaseClient,
  orderId: string,
  refundTransactions: any[]
): Promise<void> {
  const { data: customerOrders } = await supabase
    .from('customer_orders')
    .select('id, payment_history')
    .eq('shopify_order_id', orderId)

  if (!customerOrders || customerOrders.length === 0) return

  for (const order of customerOrders) {
    const paymentHistory = [...(order.payment_history || []), ...refundTransactions]

    await supabase
      .from('customer_orders')
      .update({
        payment_history: paymentHistory,
        financial_status: 'refunded',
      })
      .eq('id', order.id)

    log.info('Updated customer order with refund', { customerOrderId: order.id })
  }
}
