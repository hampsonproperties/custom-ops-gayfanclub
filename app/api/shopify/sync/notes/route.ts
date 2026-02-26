/**
 * API Endpoint: Queue Note Sync to Shopify
 *
 * POST /api/shopify/sync/notes
 * Body: { workItemId: string, noteId: string }
 *
 * Queues a work_item_note to sync to Shopify customer.note
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

export async function POST(request: NextRequest) {
  const supabase = createClient(supabaseUrl, supabaseServiceKey)

  try {
    const body = await request.json()
    const { workItemId, noteId } = body

    if (!workItemId || !noteId) {
      return NextResponse.json(
        { error: 'Missing workItemId or noteId' },
        { status: 400 }
      )
    }

    // Get work item with customer info
    const { data: workItem, error: workItemError } = await supabase
      .from('work_items')
      .select('customer_id, customers (shopify_customer_id)')
      .eq('id', workItemId)
      .single()

    if (workItemError || !workItem) {
      return NextResponse.json(
        { error: 'Work item not found' },
        { status: 404 }
      )
    }

    // Get customer's shopify_customer_id
    const shopifyCustomerId = (workItem as any).customers?.shopify_customer_id

    if (!shopifyCustomerId) {
      return NextResponse.json(
        { error: 'Customer does not have a Shopify customer ID' },
        { status: 400 }
      )
    }

    // Get the note content
    const { data: note, error: noteError } = await supabase
      .from('work_item_notes')
      .select('content')
      .eq('id', noteId)
      .single()

    if (noteError || !note) {
      return NextResponse.json(
        { error: 'Note not found' },
        { status: 404 }
      )
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
      return NextResponse.json(
        { error: `Failed to queue sync: ${queueError.message}` },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      queueItemId: queueItem.id,
      message: 'Note queued for sync to Shopify',
    })
  } catch (error) {
    console.error('Error queuing note sync:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
