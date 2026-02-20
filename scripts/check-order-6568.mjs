import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

// Load .env.local
dotenv.config({ path: join(__dirname, '..', '.env.local') })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

console.log('Checking for order #6568...\n')

// Check work_items table
console.log('1. Checking work_items table:')
const { data: workItems, error: workItemError } = await supabase
  .from('work_items')
  .select('*')
  .or('shopify_order_number.eq.#6568,design_fee_order_number.eq.#6568')

if (workItemError) {
  console.error('Error querying work_items:', workItemError)
} else if (workItems && workItems.length > 0) {
  console.log(`✓ Found ${workItems.length} work item(s):`)
  workItems.forEach(item => {
    console.log(`  - ID: ${item.id}`)
    console.log(`    Status: ${item.status}`)
    console.log(`    Customer: ${item.customer_name} (${item.customer_email})`)
    console.log(`    Shopify Order: ${item.shopify_order_number || 'N/A'}`)
    console.log(`    Source: ${item.source}`)
  })
} else {
  console.log('✗ No work items found for order #6568')
}

// Check webhook_events table
console.log('\n2. Checking webhook_events table:')
const { data: webhooks, error: webhookError } = await supabase
  .from('webhook_events')
  .select('*')
  .eq('provider', 'shopify')
  .order('created_at', { ascending: false })
  .limit(20)

if (webhookError) {
  console.error('Error querying webhooks:', webhookError)
} else {
  // Filter for order 6568 by checking payload
  const order6568Events = webhooks?.filter(w => {
    const orderName = w.payload?.name
    const orderId = w.payload?.id?.toString()
    return orderName === '#6568' || orderName === '6568'
  })

  if (order6568Events && order6568Events.length > 0) {
    console.log(`✓ Found ${order6568Events.length} webhook event(s) for order #6568:`)
    order6568Events.forEach(event => {
      console.log(`  - Event Type: ${event.event_type}`)
      console.log(`    Status: ${event.processing_status}`)
      console.log(`    Created: ${event.created_at}`)
      if (event.processing_error) {
        console.log(`    Error: ${event.processing_error}`)
      }
    })
  } else {
    console.log('✗ No webhook events found for order #6568')
    console.log(`\nRecent webhook events (last 20):`)
    webhooks?.slice(0, 5).forEach(w => {
      console.log(`  - ${w.event_type}: ${w.payload?.name || 'unknown'} (${w.processing_status})`)
    })
  }
}

// Check if order exists in Shopify by searching recent orders
console.log('\n3. Checking Shopify API for order #6568:')
console.log('(This requires making a Shopify API call...)')

process.exit(0)
