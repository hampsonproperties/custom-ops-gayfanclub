/**
 * API Endpoint: Queue Fulfillment Sync to Shopify
 *
 * POST /api/shopify/sync/fulfillment
 * Body: {
 *   orderId: string,
 *   trackingNumber?: string,
 *   trackingUrl?: string,
 *   trackingCompany?: string,
 *   lineItems?: { id: string, quantity: number }[],
 *   notifyCustomer?: boolean
 * }
 *
 * Queues fulfillment to sync to Shopify
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

export async function POST(request: NextRequest) {
  const supabase = createClient(supabaseUrl, supabaseServiceKey)

  try {
    const body = await request.json()
    const {
      orderId,
      trackingNumber,
      trackingUrl,
      trackingCompany,
      lineItems,
      notifyCustomer,
    } = body

    if (!orderId) {
      return NextResponse.json(
        { error: 'Missing orderId' },
        { status: 400 }
      )
    }

    // Get customer order with shopify_order_id
    const { data: order, error: orderError } = await supabase
      .from('customer_orders')
      .select('shopify_order_id, work_item_id, customer_id')
      .eq('id', orderId)
      .single()

    if (orderError || !order) {
      return NextResponse.json(
        { error: 'Order not found' },
        { status: 404 }
      )
    }

    // Build fulfillment payload
    const fulfillmentPayload: any = {
      tracking_number: trackingNumber,
      tracking_url: trackingUrl,
      tracking_company: trackingCompany || 'Other',
      notify_customer: notifyCustomer !== false, // Default true
    }

    if (lineItems && lineItems.length > 0) {
      fulfillmentPayload.line_items = lineItems
    }

    // Queue the sync
    const { data: queueItem, error: queueError } = await supabase
      .from('shopify_sync_queue')
      .insert({
        sync_type: 'order_fulfillment',
        shopify_resource_type: 'order',
        shopify_resource_id: order.shopify_order_id,
        sync_payload: fulfillmentPayload,
        work_item_id: order.work_item_id,
        customer_id: order.customer_id,
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
      message: 'Fulfillment queued for sync to Shopify',
    })
  } catch (error) {
    console.error('Error queuing fulfillment sync:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
