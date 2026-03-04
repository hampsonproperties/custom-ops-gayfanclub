/**
 * Check for all work items and webhook history for an order
 */

import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'
import { resolve } from 'path'

config({ path: resolve(process.cwd(), '.env.local') })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

async function checkHistory(orderNumber: string) {
  const supabase = createClient(supabaseUrl, supabaseServiceKey)

  console.log(`\n🔍 Checking full history for order ${orderNumber}...`)

  // Get current work item
  const { data: currentWorkItem } = await supabase
    .from('work_items')
    .select('*')
    .or(`shopify_order_number.eq.${orderNumber},design_fee_order_number.eq.${orderNumber}`)
    .single()

  if (!currentWorkItem) {
    console.error('❌ No work item found')
    process.exit(1)
  }

  console.log(`\n📋 Current Work Item:`)
  console.log(`   ID: ${currentWorkItem.id}`)
  console.log(`   Created: ${currentWorkItem.created_at}`)
  console.log(`   Type: ${currentWorkItem.type}`)
  console.log(`   Shopify Order ID: ${currentWorkItem.shopify_order_id}`)

  // Get ALL webhooks for this order (not just recent ones)
  const { data: allWebhooks } = await supabase
    .from('webhook_events')
    .select('*')
    .eq('provider', 'shopify')
    .eq('external_event_id', currentWorkItem.shopify_order_id)
    .order('created_at', { ascending: true })

  console.log(`\n📨 Webhook History (${allWebhooks?.length || 0} events):`)
  if (allWebhooks) {
    for (const webhook of allWebhooks) {
      console.log(`   ${webhook.created_at}: ${webhook.event_type} → ${webhook.processing_status}`)
      if (webhook.processing_error) {
        console.log(`      Error: ${webhook.processing_error}`)
      }
    }
  }

  // Check status event history
  const { data: statusEvents } = await supabase
    .from('work_item_status_events')
    .select('*')
    .eq('work_item_id', currentWorkItem.id)
    .order('created_at', { ascending: true })

  console.log(`\n🔄 Status Changes (${statusEvents?.length || 0} events):`)
  if (statusEvents) {
    for (const event of statusEvents) {
      console.log(`   ${event.created_at}: ${event.from_status || '(new)'} → ${event.to_status}`)
      if (event.note) {
        console.log(`      Note: ${event.note}`)
      }
    }
  }
}

const orderNumber = process.argv[2]

if (!orderNumber) {
  console.error('Usage: npx tsx scripts/check-order-history.ts <order-number>')
  process.exit(1)
}

checkHistory(orderNumber).catch(console.error)
