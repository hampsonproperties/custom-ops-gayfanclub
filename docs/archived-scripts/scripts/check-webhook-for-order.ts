/**
 * Check webhook events for a specific order
 */

import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'
import { resolve } from 'path'

config({ path: resolve(process.cwd(), '.env.local') })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

async function checkWebhook(orderNumber: string) {
  const supabase = createClient(supabaseUrl, supabaseServiceKey)

  console.log(`\n🔍 Searching for webhooks for order ${orderNumber}...`)

  // First get the work item to find the Shopify order ID
  const { data: workItem } = await supabase
    .from('work_items')
    .select('shopify_order_id, shopify_order_number')
    .eq('shopify_order_number', orderNumber)
    .single()

  if (!workItem || !workItem.shopify_order_id) {
    console.error('❌ Work item or order ID not found')
    process.exit(1)
  }

  console.log(`   Shopify Order ID: ${workItem.shopify_order_id}`)

  // Find webhook events for this order
  const { data: webhooks, error } = await supabase
    .from('webhook_events')
    .select('*')
    .eq('provider', 'shopify')
    .order('created_at', { ascending: false })
    .limit(20)

  if (error) {
    console.error('❌ Error fetching webhooks:', error)
    process.exit(1)
  }

  if (!webhooks || webhooks.length === 0) {
    console.log('   No webhook events found')
    return
  }

  // Filter webhooks that match this order
  const matchingWebhooks = webhooks.filter(w =>
    w.external_event_id === workItem.shopify_order_id ||
    w.payload?.id?.toString() === workItem.shopify_order_id
  )

  if (matchingWebhooks.length === 0) {
    console.log('   No webhooks found for this order')
    return
  }

  console.log(`\n📋 Found ${matchingWebhooks.length} webhook(s):`)

  for (const webhook of matchingWebhooks) {
    console.log(`\n   Webhook ID: ${webhook.id}`)
    console.log(`   Event Type: ${webhook.event_type}`)
    console.log(`   Status: ${webhook.processing_status}`)
    console.log(`   Created: ${webhook.created_at}`)
    console.log(`   Processed: ${webhook.processed_at || 'N/A'}`)

    if (webhook.processing_error) {
      console.log(`   Error: ${webhook.processing_error}`)
    }

    // Check for Customify files in payload
    const order = webhook.payload
    if (order && order.line_items) {
      console.log(`\n   Line Items: ${order.line_items.length}`)

      let customifyFileCount = 0
      for (const item of order.line_items) {
        console.log(`      - ${item.title}`)

        if (item.properties && Array.isArray(item.properties)) {
          console.log(`        Properties: ${item.properties.length}`)

          for (const prop of item.properties) {
            const propName = prop.name?.toLowerCase() || ''
            const propValue = prop.value || ''

            if (propName.includes('customify') || propName.includes('design') || propName.includes('preview')) {
              const isUrl = propValue.includes('http')
              if (isUrl) customifyFileCount++

              console.log(`          ✓ ${prop.name}: ${isUrl ? '[FILE URL]' : propValue}`)
            }
          }
        }
      }

      console.log(`\n   Detected ${customifyFileCount} Customify file URL(s) in webhook payload`)
    }
  }
}

const orderNumber = process.argv[2]

if (!orderNumber) {
  console.error('Usage: npx tsx scripts/check-webhook-for-order.ts <order-number>')
  process.exit(1)
}

checkWebhook(orderNumber).catch(console.error)
