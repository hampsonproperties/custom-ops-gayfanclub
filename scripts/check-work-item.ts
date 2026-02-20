/**
 * Script to check work item details including reason_included
 */

import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'
import { resolve } from 'path'

config({ path: resolve(process.cwd(), '.env.local') })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

async function checkWorkItem(orderNumber: string) {
  const supabase = createClient(supabaseUrl, supabaseServiceKey)

  console.log(`\n🔍 Searching for work items with order ${orderNumber}...`)

  const { data: workItems, error } = await supabase
    .from('work_items')
    .select('*')
    .or(`shopify_order_number.eq.${orderNumber},design_fee_order_number.eq.${orderNumber}`)

  if (error) {
    console.error('❌ Error:', error)
    process.exit(1)
  }

  if (!workItems || workItems.length === 0) {
    console.error('❌ No work items found')
    process.exit(1)
  }

  for (const workItem of workItems) {
    console.log(`\n📋 Work Item: ${workItem.id}`)
    console.log(`   Type: ${workItem.type}`)
    console.log(`   Status: ${workItem.status}`)
    console.log(`   Customer: ${workItem.customer_name} (${workItem.customer_email})`)
    console.log(`   Shopify Order: ${workItem.shopify_order_number || 'N/A'}`)
    console.log(`   Design Fee Order: ${workItem.design_fee_order_number || 'N/A'}`)

    if (workItem.reason_included) {
      console.log(`\n   Reason Included (detection info):`)
      console.log(`      Detected via: ${workItem.reason_included.detected_via}`)
      console.log(`      Order type: ${workItem.reason_included.order_type}`)
      console.log(`      Order tags: ${workItem.reason_included.order_tags || '(none)'}`)
      console.log(`      Has customify properties: ${workItem.reason_included.has_customify_properties}`)
    }

    // Check files
    const { data: files } = await supabase
      .from('files')
      .select('*')
      .eq('work_item_id', workItem.id)

    console.log(`\n   Files: ${files?.length || 0}`)
    if (files && files.length > 0) {
      files.forEach((file, idx) => {
        console.log(`      ${idx + 1}. ${file.original_filename} (${file.kind}) - ${file.storage_bucket}`)
      })
    }
  }
}

const orderNumber = process.argv[2]

if (!orderNumber) {
  console.error('Usage: npx tsx scripts/check-work-item.ts <order-number>')
  process.exit(1)
}

checkWorkItem(orderNumber).catch(console.error)
