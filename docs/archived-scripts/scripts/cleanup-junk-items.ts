/**
 * Cleanup Junk Work Items
 *
 * Closes or deletes test data and optionally old stale inquiries
 *
 * Run: npx tsx scripts/cleanup-junk-items.ts
 */

import { config } from 'dotenv'
import { resolve } from 'path'
import { createClient } from '@supabase/supabase-js'

config({ path: resolve(process.cwd(), '.env.local') })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

const supabase = createClient(supabaseUrl, supabaseServiceKey)

async function cleanup() {
  console.log('🧹 Starting cleanup of junk work items...\n')

  // 1. Find and close test data
  const { data: testItems } = await supabase
    .from('work_items')
    .select('*')
    .is('closed_at', null)
    .or(`customer_email.ilike.%test%,customer_email.ilike.%example.com%,customer_email.eq.alex@prideevents.org,customer_email.eq.sarah@wedding.com`)

  console.log(`🧪 Found ${testItems?.length || 0} test data items\n`)

  if (testItems && testItems.length > 0) {
    console.log('Test items to close:')
    testItems.forEach(item => {
      console.log(`   - ${item.customer_name || 'Unknown'} (${item.customer_email})`)
      console.log(`     ID: ${item.id}`)
      console.log(`     Status: ${item.status}`)
    })

    console.log('\n⚠️  Closing test items in 5 seconds... (Ctrl+C to cancel)\n')
    await new Promise(resolve => setTimeout(resolve, 5000))

    let closed = 0
    for (const item of testItems) {
      const { error } = await supabase
        .from('work_items')
        .update({
          closed_at: new Date().toISOString(),
          close_reason: 'Test data cleanup'
        })
        .eq('id', item.id)

      if (!error) {
        console.log(`✅ Closed: ${item.customer_name || item.customer_email}`)
        closed++
      } else {
        console.error(`❌ Error closing ${item.id}:`, error.message)
      }
    }

    console.log(`\n✅ Closed ${closed} test items`)
  }

  // 2. Find old new_inquiry items (>60 days)
  const sixtyDaysAgo = new Date()
  sixtyDaysAgo.setDate(sixtyDaysAgo.getDate() - 60)

  const { data: oldInquiries } = await supabase
    .from('work_items')
    .select('*')
    .eq('status', 'new_inquiry')
    .is('closed_at', null)
    .lt('created_at', sixtyDaysAgo.toISOString())

  console.log(`\n⏰ Found ${oldInquiries?.length || 0} old inquiries (>60 days, never progressed)`)

  if (oldInquiries && oldInquiries.length > 0) {
    console.log('\nOld inquiries:')
    oldInquiries.forEach(item => {
      const daysSince = Math.floor((Date.now() - new Date(item.created_at).getTime()) / (1000 * 60 * 60 * 24))
      console.log(`   - ${item.customer_name || item.customer_email || 'Unknown'}`)
      console.log(`     Created: ${daysSince} days ago`)
      console.log(`     ID: ${item.id}`)
    })

    console.log('\n❓ Do you want to close these old inquiries as "No Response"? (y/n)')
    console.log('   (Or run manually: UPDATE work_items SET closed_at=NOW(), close_reason=\'No Response\' WHERE id IN (...))')
  }

  console.log('\n✅ Cleanup complete!')
  console.log('\n💡 TIP: Add a filter to your Work Items view to hide cancelled items')
}

cleanup()
