/**
 * Identify Stale Open Items
 *
 * Find open work items that are likely dead/abandoned
 */

import { config } from 'dotenv'
import { resolve } from 'path'
import { createClient } from '@supabase/supabase-js'

config({ path: resolve(process.cwd(), '.env.local') })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

const supabase = createClient(supabaseUrl, supabaseServiceKey)

async function identifyStale() {
  console.log('🔍 Identifying stale open items...\n')

  // Get all open items
  const { data: openItems, error } = await supabase
    .from('work_items')
    .select('*')
    .is('closed_at', null)
    .order('created_at', { ascending: true }) // Oldest first

  if (error) {
    console.error('Error:', error)
    process.exit(1)
  }

  console.log(`Total open items: ${openItems?.length || 0}\n`)

  const staleCategories = {
    veryOldNewInquiry: [] as any[], // new_inquiry >30 days
    oldNewInquiry: [] as any[], // new_inquiry 14-30 days
    noActivity60Days: [] as any[], // No activity in 60+ days
    testData: [] as any[],
  }

  const now = Date.now()

  for (const item of openItems || []) {
    const createdAt = new Date(item.created_at).getTime()
    const daysSinceCreated = Math.floor((now - createdAt) / (1000 * 60 * 60 * 24))

    // Test data
    const email = item.customer_email?.toLowerCase() || ''
    const name = item.customer_name?.toLowerCase() || ''
    if (
      email.includes('test') ||
      name.includes('test') ||
      email.includes('example.com') ||
      email === 'timothy@hampsonproperties.com'
    ) {
      staleCategories.testData.push({ ...item, daysSinceCreated })
      continue
    }

    // Very old new_inquiry (>30 days)
    if (item.status === 'new_inquiry' && daysSinceCreated > 30) {
      staleCategories.veryOldNewInquiry.push({ ...item, daysSinceCreated })
      continue
    }

    // Old new_inquiry (14-30 days)
    if (item.status === 'new_inquiry' && daysSinceCreated >= 14) {
      staleCategories.oldNewInquiry.push({ ...item, daysSinceCreated })
      continue
    }

    // No activity in 60+ days (any status)
    const lastActivityAt = item.last_activity_at || item.updated_at || item.created_at
    const daysSinceActivity = Math.floor((now - new Date(lastActivityAt).getTime()) / (1000 * 60 * 60 * 24))

    if (daysSinceActivity > 60 && !['batched', 'shipped'].includes(item.status)) {
      staleCategories.noActivity60Days.push({ ...item, daysSinceActivity })
    }
  }

  // Display results
  console.log('='.repeat(80))
  console.log('📊 STALE ITEMS ANALYSIS')
  console.log('='.repeat(80))

  if (staleCategories.testData.length > 0) {
    console.log(`\n🧪 REMAINING TEST DATA (${staleCategories.testData.length} items):`)
    staleCategories.testData.forEach(item => {
      console.log(`   - ${item.customer_name || 'Unknown'} (${item.customer_email})`)
      console.log(`     Status: ${item.status} | Created: ${item.daysSinceCreated} days ago`)
      console.log(`     ID: ${item.id}`)
    })
  }

  if (staleCategories.veryOldNewInquiry.length > 0) {
    console.log(`\n⚠️  VERY OLD NEW INQUIRIES >30 DAYS (${staleCategories.veryOldNewInquiry.length} items):`)
    console.log('   These are likely dead leads that should be closed\n')
    staleCategories.veryOldNewInquiry.forEach(item => {
      console.log(`   - ${item.customer_name || item.customer_email || 'Unknown'}`)
      console.log(`     Created: ${item.daysSinceCreated} days ago`)
      console.log(`     Source: ${item.source}`)
      console.log(`     ID: ${item.id}`)
    })
  }

  if (staleCategories.oldNewInquiry.length > 0) {
    console.log(`\n⏰ OLD NEW INQUIRIES 14-30 DAYS (${staleCategories.oldNewInquiry.length} items):`)
    console.log('   These might still be viable, but getting old\n')
    staleCategories.oldNewInquiry.slice(0, 5).forEach(item => {
      console.log(`   - ${item.customer_name || item.customer_email || 'Unknown'}`)
      console.log(`     Created: ${item.daysSinceCreated} days ago`)
    })
    if (staleCategories.oldNewInquiry.length > 5) {
      console.log(`   ... and ${staleCategories.oldNewInquiry.length - 5} more`)
    }
  }

  if (staleCategories.noActivity60Days.length > 0) {
    console.log(`\n📭 NO ACTIVITY IN 60+ DAYS (${staleCategories.noActivity60Days.length} items):`)
    staleCategories.noActivity60Days.slice(0, 10).forEach(item => {
      console.log(`   - ${item.customer_name || item.customer_email || 'Unknown'}`)
      console.log(`     Status: ${item.status} | Last activity: ${item.daysSinceActivity} days ago`)
      console.log(`     ID: ${item.id}`)
    })
    if (staleCategories.noActivity60Days.length > 10) {
      console.log(`   ... and ${staleCategories.noActivity60Days.length - 10} more`)
    }
  }

  console.log('\n' + '='.repeat(80))
  console.log('📊 SUMMARY')
  console.log('='.repeat(80))
  console.log(`Total stale items: ${
    staleCategories.testData.length +
    staleCategories.veryOldNewInquiry.length +
    staleCategories.noActivity60Days.length
  }`)
  console.log(`  - Test data: ${staleCategories.testData.length}`)
  console.log(`  - Very old new_inquiry (>30d): ${staleCategories.veryOldNewInquiry.length}`)
  console.log(`  - Old new_inquiry (14-30d): ${staleCategories.oldNewInquiry.length}`)
  console.log(`  - No activity 60+ days: ${staleCategories.noActivity60Days.length}`)

  // Calculate how many would remain
  const activeItems = (openItems?.length || 0) - (
    staleCategories.testData.length +
    staleCategories.veryOldNewInquiry.length +
    staleCategories.noActivity60Days.length
  )

  console.log(`\n✅ Active items after cleanup: ${activeItems}`)

  console.log('\n💡 RECOMMENDATION:')
  console.log('   Close very old new_inquiry items (>30 days) as "No Response"')
  console.log('   Close no-activity items (>60 days) as "Abandoned"')
  console.log(`   This would reduce your list from ${openItems?.length} to ~${activeItems} items`)

  // Output IDs for bulk closing
  const toCloseIds = [
    ...staleCategories.testData.map(i => i.id),
    ...staleCategories.veryOldNewInquiry.map(i => i.id),
  ]

  if (toCloseIds.length > 0) {
    console.log(`\n📋 IDs to close (${toCloseIds.length} items):`)
    console.log(JSON.stringify(toCloseIds, null, 2))
  }
}

identifyStale()
