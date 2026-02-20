/**
 * Script to delete and re-import a misclassified Shopify order
 *
 * Usage: npx tsx scripts/reimport-order.ts <work-item-id>
 */

import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'
import { resolve } from 'path'

// Load environment variables from .env.local
config({ path: resolve(process.cwd(), '.env.local') })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

async function reimportOrder(workItemId: string) {
  const supabase = createClient(supabaseUrl, supabaseServiceKey)

  console.log(`\n🔍 Fetching work item ${workItemId}...`)

  // Get the work item details
  const { data: workItem, error: fetchError } = await supabase
    .from('work_items')
    .select('*')
    .eq('id', workItemId)
    .single()

  if (fetchError || !workItem) {
    console.error('❌ Error fetching work item:', fetchError)
    process.exit(1)
  }

  console.log(`\n📋 Current work item details:`)
  console.log(`   Type: ${workItem.type}`)
  console.log(`   Status: ${workItem.status}`)
  console.log(`   Customer: ${workItem.customer_name} (${workItem.customer_email})`)
  console.log(`   Shopify Order: ${workItem.shopify_order_number || 'N/A'}`)
  console.log(`   Design Fee Order: ${workItem.design_fee_order_number || 'N/A'}`)

  // Determine which Shopify order ID to use for re-import
  const shopifyOrderId = workItem.shopify_order_id || workItem.design_fee_order_id

  if (!shopifyOrderId) {
    console.error('❌ No Shopify order ID found on this work item')
    process.exit(1)
  }

  console.log(`\n🗑️  Deleting work item and related records...`)

  // Delete related records first (foreign key constraints)
  const deletions = [
    { table: 'files', column: 'work_item_id', name: 'files' },
    { table: 'communications', column: 'work_item_id', name: 'communications' },
    { table: 'work_item_status_events', column: 'work_item_id', name: 'status events' },
    { table: 'batch_items', column: 'work_item_id', name: 'batch items' },
  ]

  for (const deletion of deletions) {
    const { data, error } = await supabase
      .from(deletion.table)
      .delete()
      .eq(deletion.column, workItemId)
      .select()

    if (error) {
      console.error(`   ❌ Error deleting ${deletion.name}:`, error.message)
    } else {
      console.log(`   ✓ Deleted ${data?.length || 0} ${deletion.name}`)
    }
  }

  // Delete the work item itself
  const { error: deleteError } = await supabase
    .from('work_items')
    .delete()
    .eq('id', workItemId)

  if (deleteError) {
    console.error('❌ Error deleting work item:', deleteError)
    process.exit(1)
  }

  console.log('   ✓ Work item deleted')

  console.log(`\n🔄 Re-importing Shopify order ${shopifyOrderId}...`)
  console.log(`\n⚠️  MANUAL STEPS REQUIRED:`)
  console.log(`\n1. Go to: https://custom-ops-gayfanclub.vercel.app/admin/import-orders`)
  console.log(`2. Search for order: ${workItem.shopify_order_number || workItem.design_fee_order_number}`)
  console.log(`3. Click "Import Order" button`)
  console.log(`\nThe order should now be correctly classified as a Customify order with files.`)
  console.log(`\n✅ Work item deleted successfully!`)

  const importResult = {
    workItemId: null,
    filesImported: 0
  }

}

// Get work item ID from command line args
const workItemId = process.argv[2]

if (!workItemId) {
  console.error('Usage: npx tsx scripts/reimport-order.ts <work-item-id>')
  process.exit(1)
}

reimportOrder(workItemId).catch(console.error)
