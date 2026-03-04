/**
 * API Endpoint: Queue Tags Sync to Shopify
 *
 * POST /api/shopify/sync/tags
 * Body: { customerId: string, tags: string[] }
 *
 * Queues customer tags to sync to Shopify
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { validateBody } from '@/lib/api/validate'
import { syncTagsBody } from '@/lib/api/schemas'
import { logger } from '@/lib/logger'
import { badRequest, notFound, serverError } from '@/lib/api/errors'

const log = logger('shopify-sync-tags')


export async function POST(request: NextRequest) {
  const supabase = await createClient()

  try {
    const bodyResult = validateBody(await request.json(), syncTagsBody)
    if (bodyResult.error) return bodyResult.error
    const { customerId, tags } = bodyResult.data

    // Get customer's shopify_customer_id
    const { data: customer, error: customerError } = await supabase
      .from('customers')
      .select('shopify_customer_id')
      .eq('id', customerId)
      .single()

    if (customerError || !customer) {
      return notFound('Customer not found')
    }

    if (!customer.shopify_customer_id) {
      return badRequest('Customer does not have a Shopify customer ID')
    }

    // Queue the sync
    const { data: queueItem, error: queueError } = await supabase
      .from('shopify_sync_queue')
      .insert({
        sync_type: 'customer_tags',
        shopify_resource_type: 'customer',
        shopify_resource_id: customer.shopify_customer_id,
        sync_payload: { tags },
        customer_id: customerId,
        status: 'pending',
      })
      .select('id')
      .single()

    if (queueError) {
      return serverError(`Failed to queue sync: ${queueError.message}`)
    }

    return NextResponse.json({
      success: true,
      queueItemId: queueItem.id,
      message: 'Tags queued for sync to Shopify',
    })
  } catch (error) {
    log.error('Error queuing tags sync', { error })
    return serverError('Internal server error')
  }
}
