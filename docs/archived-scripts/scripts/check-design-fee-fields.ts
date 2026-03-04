/**
 * Check if design fee fields are populated instead of main Shopify fields
 */

import { config } from 'dotenv'
import { resolve } from 'path'
import { createClient } from '@supabase/supabase-js'

config({ path: resolve(process.cwd(), '.env.local') })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

const supabase = createClient(supabaseUrl, supabaseServiceKey)

async function checkDesignFeeFields() {
  console.log('🔍 Checking design fee order fields...\n')

  // Get Kandice Hart's work item with ALL fields
  const { data: kandice } = await supabase
    .from('work_items')
    .select('*')
    .eq('customer_email', 'kandicehart4@gmail.com')
    .eq('type', 'assisted_project')
    .single()

  if (kandice) {
    console.log('📦 Kandice Hart:')
    console.log(`   shopify_order_id: ${kandice.shopify_order_id || 'NULL'}`)
    console.log(`   shopify_order_number: ${kandice.shopify_order_number || 'NULL'}`)
    console.log(`   design_fee_order_id: ${kandice.design_fee_order_id || 'NULL'}`)
    console.log(`   design_fee_order_number: ${kandice.design_fee_order_number || 'NULL'}`)
    console.log(`   shopify_draft_order_id: ${kandice.shopify_draft_order_id || 'NULL'}`)
    console.log()
  }

  // Check all assisted projects without ANY Shopify linkage
  const { data: items } = await supabase
    .from('work_items')
    .select('id, customer_name, customer_email, design_fee_order_id, design_fee_order_number, reason_included')
    .eq('type', 'assisted_project')
    .eq('source', 'shopify')
    .is('shopify_order_number', null)
    .is('closed_at', null)
    .limit(5)

  console.log('📊 Checking if they have design_fee fields instead:\n')

  for (const item of items || []) {
    console.log(`${item.customer_name}:`)
    console.log(`   design_fee_order_id: ${item.design_fee_order_id || 'NULL'}`)
    console.log(`   design_fee_order_number: ${item.design_fee_order_number || 'NULL'}`)

    // Check for webhooks with this customer email
    if (item.customer_email) {
      const { data: webhooks } = await supabase
        .from('webhook_events')
        .select('id, event_type, processing_status, created_at, payload')
        .eq('provider', 'shopify')
        .order('created_at', { ascending: false })
        .limit(100)

      // Filter webhooks that might match this customer
      const matchingWebhooks = webhooks?.filter(w => {
        const payload = w.payload as any
        return payload?.customer?.email === item.customer_email
      }) || []

      if (matchingWebhooks.length > 0) {
        console.log(`   ✅ Found ${matchingWebhooks.length} matching webhooks`)
        const latest = matchingWebhooks[0]
        const payload = latest.payload as any
        console.log(`      Latest: ${latest.event_type} - Order #${payload.name || payload.id}`)
        console.log(`      Status: ${latest.processing_status}`)
      } else {
        console.log(`   ❌ No matching webhooks found`)
      }
    }

    console.log()
  }
}

checkDesignFeeFields()
