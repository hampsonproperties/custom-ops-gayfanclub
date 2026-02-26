/**
 * API Endpoint: Queue Tags Sync to Shopify
 *
 * POST /api/shopify/sync/tags
 * Body: { customerId: string, tags: string[] }
 *
 * Queues customer tags to sync to Shopify
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

export async function POST(request: NextRequest) {
  const supabase = createClient(supabaseUrl, supabaseServiceKey)

  try {
    const body = await request.json()
    const { customerId, tags } = body

    if (!customerId || !tags || !Array.isArray(tags)) {
      return NextResponse.json(
        { error: 'Missing or invalid customerId or tags' },
        { status: 400 }
      )
    }

    // Get customer's shopify_customer_id
    const { data: customer, error: customerError } = await supabase
      .from('customers')
      .select('shopify_customer_id')
      .eq('id', customerId)
      .single()

    if (customerError || !customer) {
      return NextResponse.json(
        { error: 'Customer not found' },
        { status: 404 }
      )
    }

    if (!customer.shopify_customer_id) {
      return NextResponse.json(
        { error: 'Customer does not have a Shopify customer ID' },
        { status: 400 }
      )
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
      return NextResponse.json(
        { error: `Failed to queue sync: ${queueError.message}` },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      queueItemId: queueItem.id,
      message: 'Tags queued for sync to Shopify',
    })
  } catch (error) {
    console.error('Error queuing tags sync:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
