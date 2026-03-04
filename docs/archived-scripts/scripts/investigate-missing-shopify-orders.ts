/**
 * Investigate Missing Shopify Order Numbers
 *
 * Checks why Shopify-sourced work items don't have order numbers
 * and looks at the shopify_order_id, webhook data, etc.
 */

import { config } from 'dotenv'
import { resolve } from 'path'
import { createClient } from '@supabase/supabase-js'

config({ path: resolve(process.cwd(), '.env.local') })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

const supabase = createClient(supabaseUrl, supabaseServiceKey)

async function investigateMissingOrders() {
  console.log('🔍 Investigating Shopify-sourced work items without order numbers...\n')

  // Get Shopify work items without order numbers
  const { data: items, error } = await supabase
    .from('work_items')
    .select('*')
    .eq('type', 'assisted_project')
    .eq('source', 'shopify')
    .is('shopify_order_number', null)
    .is('closed_at', null)
    .order('created_at', { ascending: false })

  if (error) {
    console.error('Error:', error)
    process.exit(1)
  }

  if (!items || items.length === 0) {
    console.log('✅ All Shopify work items have order numbers!')
    return
  }

  console.log(`Found ${items.length} Shopify items WITHOUT order numbers\n`)
  console.log('='.repeat(80))

  for (const item of items) {
    console.log(`\n📦 ${item.customer_name || 'Unknown'}`)
    console.log(`   ID: ${item.id}`)
    console.log(`   Email: ${item.customer_email || 'N/A'}`)
    console.log(`   Status: ${item.status}`)
    console.log(`   Created: ${new Date(item.created_at).toLocaleDateString()}`)
    console.log(`   shopify_order_id: ${item.shopify_order_id || 'NULL'}`)
    console.log(`   shopify_draft_order_id: ${item.shopify_draft_order_id || 'NULL'}`)
    console.log(`   shopify_order_number: ${item.shopify_order_number || 'NULL'}`)

    // Check if there's a Shopify order ID but no order number
    if (item.shopify_order_id) {
      console.log(`   ⚠️  HAS shopify_order_id but NO order number!`)

      // Try to find the webhook that created this
      const { data: webhook } = await supabase
        .from('webhook_events')
        .select('*')
        .eq('shopify_order_id', item.shopify_order_id)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()

      if (webhook) {
        console.log(`   📡 Found webhook:`)
        console.log(`      Topic: ${webhook.topic}`)
        console.log(`      Status: ${webhook.processing_status}`)

        // Check the payload for order number
        if (webhook.payload && typeof webhook.payload === 'object') {
          const payload = webhook.payload as any
          if (payload.order_number || payload.name) {
            console.log(`      ✅ Payload HAS order number: ${payload.order_number || payload.name}`)
            console.log(`      🔧 This can be fixed by updating the work item!`)
          }
        }
      }
    } else if (item.shopify_draft_order_id) {
      console.log(`   ℹ️  Has draft order ID (draft orders may not have numbers yet)`)
    } else {
      console.log(`   ❌ No Shopify IDs at all - data may be corrupted`)
    }

    if (item.reason_included) {
      console.log(`   Reason: ${JSON.stringify(item.reason_included)}`)
    }
  }

  console.log('\n' + '='.repeat(80))
  console.log('📊 SUMMARY')
  console.log('='.repeat(80))

  const hasOrderId = items.filter(i => i.shopify_order_id).length
  const hasDraftId = items.filter(i => i.shopify_draft_order_id && !i.shopify_order_id).length
  const hasNeither = items.filter(i => !i.shopify_order_id && !i.shopify_draft_order_id).length

  console.log(`Total items without order numbers: ${items.length}`)
  console.log(`  - Has shopify_order_id (can be fixed): ${hasOrderId}`)
  console.log(`  - Has shopify_draft_order_id only: ${hasDraftId}`)
  console.log(`  - Has no Shopify IDs: ${hasNeither}`)

  if (hasOrderId > 0) {
    console.log(`\n💡 ${hasOrderId} items have Shopify order IDs but missing order numbers!`)
    console.log(`   This is likely a bug in the webhook processing.`)
    console.log(`   We can create a script to backfill the order numbers from webhooks.`)
  }
}

investigateMissingOrders()
