/**
 * Shopify Customer Processor
 *
 * Handles customers/create and customers/update webhook events.
 * Only UPDATES existing customer records — does NOT create new ones.
 * Customers are created via order processing (findOrCreateCustomer),
 * not from the customer webhook, to avoid polluting the CRM with
 * browse-only Shopify accounts that never placed an order.
 */

import { SupabaseClient } from '@supabase/supabase-js'
import { logger } from '@/lib/logger'

const log = logger('shopify-customer-processor')

/**
 * Process a Shopify customer webhook.
 * Updates existing customer records and syncs notes to linked work items.
 * Skips creation of new customers — those are created during order processing.
 */
export async function processCustomer(
  supabase: SupabaseClient,
  customer: any,
  webhookEventId: string
): Promise<void> {
  log.info('Processing customer', { customerId: customer.id })

  try {
    // Look for existing customer by email or shopify_customer_id
    let existingCustomer = null

    if (customer.email) {
      const { data } = await supabase
        .from('customers')
        .select('id')
        .eq('email', customer.email.toLowerCase())
        .maybeSingle()
      existingCustomer = data
    }

    if (!existingCustomer && customer.id) {
      const { data } = await supabase
        .from('customers')
        .select('id')
        .eq('shopify_customer_id', customer.id.toString())
        .maybeSingle()
      existingCustomer = data
    }

    if (existingCustomer) {
      // Update existing customer with latest Shopify data
      await supabase
        .from('customers')
        .update({
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
        })
        .eq('id', existingCustomer.id)
      log.info('Updated customer', { customerId: existingCustomer.id })
    } else {
      // Skip creation — customers are created during order processing
      log.info('Skipped customer creation (no existing record, will be created when they order)', {
        shopifyCustomerId: customer.id,
        email: customer.email,
      })
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
        error_message: error.message,
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
