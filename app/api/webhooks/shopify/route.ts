/**
 * Shopify Webhook Handler (Thin Dispatcher)
 *
 * Verifies HMAC → logs webhook event → returns 200 immediately →
 * processes in the background via after().
 *
 * All processing logic lives in lib/shopify/processors/.
 */

import { NextRequest, NextResponse } from 'next/server'
import { after } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { headers } from 'next/headers'
import crypto from 'crypto'
import { processOrder } from '@/lib/shopify/processors/order-processor'
import { processFulfillment } from '@/lib/shopify/processors/fulfillment-processor'
import { processCustomer } from '@/lib/shopify/processors/customer-processor'
import { processRefund } from '@/lib/shopify/processors/refund-processor'
import { unauthorized, serverError } from '@/lib/api/errors'
import { logger } from '@/lib/logger'

const log = logger('shopify-webhook')

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

export async function POST(request: NextRequest) {
  const supabase = createClient(supabaseUrl, supabaseServiceKey)

  try {
    const headersList = await headers()
    const topic = headersList.get('x-shopify-topic')
    const hmac = headersList.get('x-shopify-hmac-sha256')

    const body = await request.text()

    // Verify HMAC — mandatory for all Shopify webhooks
    const secret = process.env.SHOPIFY_WEBHOOK_SECRET
    if (!secret || !hmac) {
      log.error('Rejected: missing HMAC or webhook secret')
      return unauthorized('HMAC verification required')
    }

    const hash = crypto
      .createHmac('sha256', secret)
      .update(body, 'utf8')
      .digest('base64')

    if (hash !== hmac) {
      log.error('Rejected: HMAC verification failed')
      return unauthorized('Invalid HMAC')
    }

    const payload = JSON.parse(body)
    const externalEventId = payload.id?.toString()

    // Check for duplicate webhook (idempotency)
    const { data: existingEvent } = await supabase
      .from('webhook_events')
      .select('id, processing_status')
      .eq('provider', 'shopify')
      .eq('external_event_id', externalEventId)
      .single()

    if (existingEvent?.processing_status === 'completed') {
      return NextResponse.json({ received: true, status: 'duplicate_processed' })
    }

    // Create or reuse webhook event record
    let webhookEventId: string

    if (existingEvent) {
      webhookEventId = existingEvent.id
    } else {
      const { data: webhookEvent, error: insertError } = await supabase
        .from('webhook_events')
        .insert({
          provider: 'shopify',
          event_type: topic || 'unknown',
          external_event_id: externalEventId,
          payload: payload,
          processing_status: 'pending',
        })
        .select()
        .single()

      if (insertError) {
        log.error('Failed to create webhook event', { error: insertError })
        return serverError('Failed to log webhook event')
      }

      webhookEventId = webhookEvent.id
    }

    // Mark as processing
    await supabase
      .from('webhook_events')
      .update({
        processing_status: 'processing',
      })
      .eq('id', webhookEventId)

    // Process in the background — response returns immediately
    after(async () => {
      try {
        if (topic === 'orders/create' || topic === 'orders/updated') {
          await processOrder(supabase, payload, webhookEventId)
        } else if (topic === 'fulfillments/create' || topic === 'orders/fulfilled') {
          await processFulfillment(supabase, payload, webhookEventId)
        } else if (topic === 'customers/create' || topic === 'customers/update') {
          await processCustomer(supabase, payload, webhookEventId)
        } else if (topic === 'refunds/create') {
          await processRefund(supabase, payload, webhookEventId)
        } else {
          // Unknown topic — mark as skipped
          await supabase
            .from('webhook_events')
            .update({
              processing_status: 'skipped',
              processed_at: new Date().toISOString(),
            })
            .eq('id', webhookEventId)
        }
      } catch (error) {
        log.error('Background processing failed', { error, topic, webhookEventId })
        await supabase
          .from('webhook_events')
          .update({
            processing_status: 'failed',
            error_message: error instanceof Error ? error.message : String(error),
          })
          .eq('id', webhookEventId)
      }
    })

    return NextResponse.json({ received: true })
  } catch (error) {
    log.error('Webhook handler error', { error })
    return serverError('Webhook processing failed')
  }
}
