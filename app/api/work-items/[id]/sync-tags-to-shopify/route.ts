import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { serverError } from '@/lib/api/errors'
import { logger } from '@/lib/logger'

const log = logger('work-items-sync-tags-to-shopify')

/**
 * POST /api/work-items/[id]/sync-tags-to-shopify
 *
 * After a tag is added/removed on a work item, this endpoint aggregates
 * ALL tags across ALL of the linked customer's work items and queues
 * a push to Shopify. Shopify tags live on the CUSTOMER, so we send
 * the complete tag set.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: workItemId } = await params
    const supabase = await createClient()

    // 1. Get the work item's customer_id
    const { data: workItem, error: wiError } = await supabase
      .from('work_items')
      .select('customer_id')
      .eq('id', workItemId)
      .single()

    if (wiError || !workItem?.customer_id) {
      // No customer linked — nothing to sync to Shopify
      return NextResponse.json({ skipped: true, reason: 'no_customer' })
    }

    // 2. Get the customer's shopify_customer_id
    const { data: customer, error: custError } = await supabase
      .from('customers')
      .select('shopify_customer_id')
      .eq('id', workItem.customer_id)
      .single()

    if (custError || !customer?.shopify_customer_id) {
      // Customer not linked to Shopify — nothing to push
      return NextResponse.json({ skipped: true, reason: 'no_shopify_customer' })
    }

    // 3. Aggregate ALL tags across ALL work items for this customer
    // Two-step query: get work item IDs first, then their tags
    let tagNames: string[] = []

    const { data: customerWorkItems } = await supabase
      .from('work_items')
      .select('id')
      .eq('customer_id', workItem.customer_id)

    if (customerWorkItems && customerWorkItems.length > 0) {
      const workItemIds = customerWorkItems.map(wi => wi.id)
      const { data: allWorkItemTags, error: tagsError } = await supabase
        .from('work_item_tags')
        .select('tag:tags(name)')
        .in('work_item_id', workItemIds)

      if (!tagsError) {
        tagNames = [...new Set(
          (allWorkItemTags || [])
            .map((t: any) => t.tag?.name)
            .filter(Boolean)
        )]
      }
    }

    // 4. Queue push to Shopify via sync queue
    const { error: queueError } = await supabase
      .from('shopify_sync_queue')
      .insert({
        sync_type: 'customer_tags',
        shopify_resource_type: 'customer',
        shopify_resource_id: customer.shopify_customer_id,
        sync_payload: { tags: tagNames },
        customer_id: workItem.customer_id,
        status: 'pending',
      })

    if (queueError) {
      log.error('Failed to queue tag sync', { error: queueError, workItemId })
      return serverError('Failed to queue tag sync')
    }

    log.info('Queued tag sync to Shopify', {
      workItemId,
      customerId: workItem.customer_id,
      shopifyCustomerId: customer.shopify_customer_id,
      tags: tagNames,
    })

    return NextResponse.json({
      success: true,
      tags: tagNames,
      shopifyCustomerId: customer.shopify_customer_id,
    })
  } catch (error) {
    log.error('Sync tags to Shopify error', { error })
    return serverError(error instanceof Error ? error.message : 'Failed to sync tags')
  }
}
