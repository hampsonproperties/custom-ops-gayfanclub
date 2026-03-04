/**
 * Shopify Customer Processor
 *
 * Handles customers/create and customers/update webhook events.
 * Upserts customer master records and syncs notes to linked work items.
 * Uses batch operations instead of per-work-item queries (N+1 fix).
 */

import { SupabaseClient } from '@supabase/supabase-js'
import { logger } from '@/lib/logger'

const log = logger('shopify-customer-processor')

/**
 * Process a Shopify customer webhook.
 * Upserts the customer record and syncs their note to any linked work items.
 */
export async function processCustomer(
  supabase: SupabaseClient,
  customer: any,
  webhookEventId: string
): Promise<void> {
  log.info('Processing customer', { customerId: customer.id })

  try {
    // Upsert customer master record
    const { data: existingCustomer } = await supabase
      .from('customers')
      .select('id')
      .eq('email', customer.email?.toLowerCase())
      .maybeSingle()

    const customerData = {
      email: customer.email?.toLowerCase(),
      first_name: customer.first_name,
      last_name: customer.last_name,
      phone: customer.phone,
      shopify_customer_id: customer.id?.toString(),
      tags: customer.tags?.split(',').map((t: string) => t.trim()).filter(Boolean) || [],
      metadata: {
        accepts_marketing: customer.accepts_marketing,
        email_marketing_consent: customer.email_marketing_consent,
        sms_marketing_consent: customer.sms_marketing_consent,
        default_address: customer.default_address,
        shopify_created_at: customer.created_at,
        shopify_updated_at: customer.updated_at,
      },
    }

    if (existingCustomer) {
      await supabase
        .from('customers')
        .update(customerData)
        .eq('id', existingCustomer.id)
      log.info('Updated customer', { customerId: existingCustomer.id })
    } else {
      const { data: newCustomer } = await supabase
        .from('customers')
        .insert(customerData)
        .select('id')
        .single()
      log.info('Created new customer', { customerId: newCustomer?.id })
    }

    // Sync customer note to linked work items (batch N+1 fix)
    if (customer.note?.trim()) {
      await syncCustomerNoteToWorkItems(supabase, customer)
    }

    // Mark webhook as completed
    await supabase
      .from('webhook_events')
      .update({
        processing_status: 'completed',
        processed_at: new Date().toISOString(),
      })
      .eq('id', webhookEventId)
  } catch (error: any) {
    log.error('Error processing customer', { error })
    await supabase
      .from('webhook_events')
      .update({
        processing_status: 'failed',
        processing_error: error.message,
      })
      .eq('id', webhookEventId)
    throw error
  }
}

/**
 * Syncs a customer's Shopify note to all their linked work items.
 *
 * N+1 fix: Instead of looping through each work item and doing a
 * check-then-insert, we batch-fetch existing notes in one query,
 * then batch-insert the missing ones in one query.
 */
async function syncCustomerNoteToWorkItems(
  supabase: SupabaseClient,
  customer: any
): Promise<void> {
  const { data: workItems } = await supabase
    .from('work_items')
    .select('id')
    .eq('email', customer.email?.toLowerCase())

  if (!workItems || workItems.length === 0) return

  const workItemIds = workItems.map((w: any) => w.id)
  const externalId = customer.id?.toString()

  // Batch fetch: which work items already have this customer's note?
  const { data: existingNotes } = await supabase
    .from('work_item_notes')
    .select('work_item_id')
    .in('work_item_id', workItemIds)
    .eq('source', 'shopify')
    .eq('external_id', externalId)

  const existingWorkItemIds = new Set((existingNotes || []).map((n: any) => n.work_item_id))

  // Batch insert notes for work items that don't have one yet
  const notesToInsert = workItems
    .filter((w: any) => !existingWorkItemIds.has(w.id))
    .map((workItem: any) => ({
      work_item_id: workItem.id,
      content: `[Shopify Customer Note]\n${customer.note}`,
      author_email: 'shopify-sync@system',
      source: 'shopify',
      external_id: externalId,
      synced_at: new Date().toISOString(),
    }))

  if (notesToInsert.length > 0) {
    await supabase.from('work_item_notes').insert(notesToInsert)
    log.info('Synced customer note to work items', { count: notesToInsert.length })
  }
}
