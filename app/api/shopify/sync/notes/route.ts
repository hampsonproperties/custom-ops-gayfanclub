/**
 * API Endpoint: Queue Note Sync to Shopify
 *
 * POST /api/shopify/sync/notes
 * Body: { workItemId: string, noteId: string }
 *
 * Queues a work_item_note to sync to Shopify customer.note
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { validateBody } from '@/lib/api/validate'
import { syncNotesBody } from '@/lib/api/schemas'
import { logger } from '@/lib/logger'
import { badRequest, notFound, serverError } from '@/lib/api/errors'

const log = logger('shopify-sync-notes')


export async function POST(request: NextRequest) {
  const supabase = await createClient()

  try {
    const bodyResult = validateBody(await request.json(), syncNotesBody)
    if (bodyResult.error) return bodyResult.error
    const { workItemId, noteId } = bodyResult.data

    // Get work item with customer info
    const { data: workItem, error: workItemError } = await supabase
      .from('work_items')
      .select('customer_id, customers (shopify_customer_id)')
      .eq('id', workItemId)
      .single()

    if (workItemError || !workItem) {
      return notFound('Work item not found')
    }

    // Get customer's shopify_customer_id
    const shopifyCustomerId = (workItem as any).customers?.shopify_customer_id

    if (!shopifyCustomerId) {
      return badRequest('Customer does not have a Shopify customer ID')
    }

    // Get the note content
    const { data: note, error: noteError } = await supabase
      .from('work_item_notes')
      .select('content')
      .eq('id', noteId)
      .single()

    if (noteError || !note) {
      return notFound('Note not found')
    }

    // Queue the sync
    const { data: queueItem, error: queueError } = await supabase
      .from('shopify_sync_queue')
      .insert({
        sync_type: 'customer_note',
        shopify_resource_type: 'customer',
        shopify_resource_id: shopifyCustomerId,
        sync_payload: { note: note.content },
        work_item_id: workItemId,
        customer_id: workItem.customer_id,
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
      message: 'Note queued for sync to Shopify',
    })
  } catch (error) {
    log.error('Error queuing note sync', { error })
    return serverError('Internal server error')
  }
}
