/**
 * Reprocess Webhook Events
 *
 * Re-runs a failed or stuck webhook event through the same shared
 * processors used by the main Shopify webhook handler. This ensures
 * reprocessing has identical behavior to the original processing
 * (three-tier routing, Faire auto-creation, etc.).
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { validateBody } from '@/lib/api/validate'
import { reprocessWebhookBody } from '@/lib/api/schemas'
import { badRequest, notFound, serverError } from '@/lib/api/errors'
import { processOrder } from '@/lib/shopify/processors/order-processor'
import { processFulfillment } from '@/lib/shopify/processors/fulfillment-processor'
import { processCustomer } from '@/lib/shopify/processors/customer-processor'
import { processRefund } from '@/lib/shopify/processors/refund-processor'
import { logger } from '@/lib/logger'

const log = logger('api-webhooks-reprocess')

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

export async function POST(request: NextRequest) {
  try {
    const bodyResult = validateBody(await request.json(), reprocessWebhookBody)
    if (bodyResult.error) return bodyResult.error
    const { webhookId } = bodyResult.data

    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // Fetch the webhook event
    const { data: webhookEvent, error: fetchError } = await supabase
      .from('webhook_events')
      .select('*')
      .eq('id', webhookId)
      .single()

    if (fetchError || !webhookEvent) {
      return notFound('Webhook event not found')
    }

    // Check if already completed
    if (webhookEvent.processing_status === 'completed') {
      return badRequest('Webhook already processed successfully')
    }

    // Mark as processing
    await supabase
      .from('webhook_events')
      .update({
        processing_status: 'processing',
        error_message: null,
      })
      .eq('id', webhookId)

    // Reprocess using the same shared processors as the main webhook handler
    const payload = webhookEvent.payload
    const eventType = webhookEvent.event_type

    try {
      if (eventType === 'orders/create' || eventType === 'orders/updated') {
        await processOrder(supabase, payload, webhookId)
      } else if (eventType === 'fulfillments/create' || eventType === 'orders/fulfilled') {
        await processFulfillment(supabase, payload, webhookId)
      } else if (eventType === 'customers/create' || eventType === 'customers/update') {
        await processCustomer(supabase, payload, webhookId)
      } else if (eventType === 'refunds/create') {
        await processRefund(supabase, payload, webhookId)
      } else {
        // Unknown event type
        await supabase
          .from('webhook_events')
          .update({
            processing_status: 'skipped',
            processed_at: new Date().toISOString(),
          })
          .eq('id', webhookId)
      }

      return NextResponse.json({ success: true })
    } catch (processingError) {
      // Mark as failed again
      await supabase
        .from('webhook_events')
        .update({
          processing_status: 'failed',
          error_message:
            processingError instanceof Error
              ? processingError.message
              : String(processingError),
        })
        .eq('id', webhookId)

      throw processingError
    }
  } catch (error) {
    log.error('Reprocess error', { error })
    return serverError(error instanceof Error ? error.message : 'Reprocessing failed')
  }
}
