/**
 * Identify Junk Work Items
 *
 * Finds work items that are likely test data, duplicates, or otherwise invalid
 *
 * Run: npx tsx scripts/identify-junk-work-items.ts
 */

import { config } from 'dotenv'
import { resolve } from 'path'
import { createClient } from '@supabase/supabase-js'

config({ path: resolve(process.cwd(), '.env.local') })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

const supabase = createClient(supabaseUrl, supabaseServiceKey)

async function identifyJunk() {
  console.log('🔍 Identifying potential junk work items...\n')

  const junkCategories = {
    testData: [] as any[],
    noCustomerInfo: [] as any[],
    oldInquiries: [] as any[],
    duplicates: [] as any[],
    stuckInNewInquiry: [] as any[],
  }

  // Get all open work items
  const { data: allItems, error } = await supabase
    .from('work_items')
    .select('*')
    .is('closed_at', null)
    .order('created_at', { ascending: false })

  if (error) {
    console.error('Error fetching work items:', error)
    process.exit(1)
  }

  console.log(`Total open work items: ${allItems?.length || 0}\n`)

  for (const item of allItems || []) {
    const name = item.customer_name?.toLowerCase() || ''
    const email = item.customer_email?.toLowerCase() || ''
    const title = item.title?.toLowerCase() || ''

    // Test data detection
    if (
      name.includes('test') ||
      name.includes('demo') ||
      email.includes('test') ||
      email.includes('example.com') ||
      email === 'alex@prideevents.org' || // From initial seed data
      email === 'sarah@wedding.com' // From initial seed data
    ) {
      junkCategories.testData.push(item)
      continue
    }

    // No customer information
    if (!item.customer_name && !item.customer_email) {
      junkCategories.noCustomerInfo.push(item)
      continue
    }

    // Old inquiries that never progressed (>30 days)
    if (item.status === 'new_inquiry') {
      const createdAt = new Date(item.created_at)
      const daysSince = Math.floor((Date.now() - createdAt.getTime()) / (1000 * 60 * 60 * 24))

      if (daysSince > 30) {
        junkCategories.stuckInNewInquiry.push(item)
      }
    }
  }

  // Find duplicates by email
  const emailMap = new Map<string, any[]>()
  for (const item of allItems || []) {
    if (item.customer_email) {
      const email = item.customer_email.toLowerCase()
      if (!emailMap.has(email)) {
        emailMap.set(email, [])
      }
      emailMap.get(email)!.push(item)
    }
  }

  for (const [email, items] of emailMap.entries()) {
    if (items.length > 3) { // More than 3 work items for same customer
      junkCategories.duplicates.push(...items)
    }
  }

  // Display results
  console.log('=' .repeat(80))
  console.log('📊 JUNK DATA ANALYSIS')
  console.log('='.repeat(80))

  if (junkCategories.testData.length > 0) {
    console.log(`\n🧪 TEST DATA (${junkCategories.testData.length} items):`)
    junkCategories.testData.forEach(item => {
      console.log(`   - ${item.customer_name || 'Unknown'} (${item.customer_email || 'no email'})`)
      console.log(`     ID: ${item.id}`)
      console.log(`     Status: ${item.status}`)
      console.log(`     Created: ${new Date(item.created_at).toLocaleDateString()}`)
    })
  }

  if (junkCategories.noCustomerInfo.length > 0) {
    console.log(`\n❌ NO CUSTOMER INFO (${junkCategories.noCustomerInfo.length} items):`)
    junkCategories.noCustomerInfo.slice(0, 10).forEach(item => {
      console.log(`   - ID: ${item.id}`)
      console.log(`     Title: ${item.title || 'N/A'}`)
      console.log(`     Status: ${item.status}`)
      console.log(`     Source: ${item.source}`)
      console.log(`     Created: ${new Date(item.created_at).toLocaleDateString()}`)
    })
    if (junkCategories.noCustomerInfo.length > 10) {
      console.log(`   ... and ${junkCategories.noCustomerInfo.length - 10} more`)
    }
  }

  if (junkCategories.stuckInNewInquiry.length > 0) {
    console.log(`\n⏰ STUCK IN NEW INQUIRY >30 DAYS (${junkCategories.stuckInNewInquiry.length} items):`)
    junkCategories.stuckInNewInquiry.slice(0, 10).forEach(item => {
      const daysSince = Math.floor((Date.now() - new Date(item.created_at).getTime()) / (1000 * 60 * 60 * 24))
      console.log(`   - ${item.customer_name || item.customer_email || 'Unknown'}`)
      console.log(`     Created: ${daysSince} days ago`)
      console.log(`     ID: ${item.id}`)
    })
    if (junkCategories.stuckInNewInquiry.length > 10) {
      console.log(`   ... and ${junkCategories.stuckInNewInquiry.length - 10} more`)
    }
  }

  if (junkCategories.duplicates.length > 0) {
    console.log(`\n👥 POTENTIAL DUPLICATES (${junkCategories.duplicates.length} items):`)
    const dupeEmails = new Map<string, any[]>()
    for (const item of junkCategories.duplicates) {
      const email = item.customer_email.toLowerCase()
      if (!dupeEmails.has(email)) {
        dupeEmails.set(email, [])
      }
      dupeEmails.get(email)!.push(item)
    }

    for (const [email, items] of dupeEmails.entries()) {
      console.log(`\n   ${email} (${items.length} work items):`)
      items.forEach(item => {
        console.log(`     - ${item.status} | Created: ${new Date(item.created_at).toLocaleDateString()} | ID: ${item.id}`)
      })
    }
  }

  console.log('\n' + '='.repeat(80))
  console.log('📊 SUMMARY')
  console.log('='.repeat(80))
  console.log(`Total potential junk items: ${
    junkCategories.testData.length +
    junkCategories.noCustomerInfo.length +
    junkCategories.stuckInNewInquiry.length
  }`)
  console.log(`  - Test data: ${junkCategories.testData.length}`)
  console.log(`  - No customer info: ${junkCategories.noCustomerInfo.length}`)
  console.log(`  - Stuck in new_inquiry >30 days: ${junkCategories.stuckInNewInquiry.length}`)
  console.log(`  - Potential duplicates: ${junkCategories.duplicates.length}`)

  console.log('\n💡 NEXT STEPS:')
  console.log('   1. Review the items above')
  console.log('   2. Run the cleanup script to close/delete junk items')
  console.log('   3. Or manually close them in the UI')

  // Export IDs for easy cleanup
  const allJunkIds = [
    ...junkCategories.testData.map(i => i.id),
    ...junkCategories.noCustomerInfo.map(i => i.id),
  ]

  if (allJunkIds.length > 0) {
    console.log(`\n📋 Junk item IDs (for cleanup script):`)
    console.log(JSON.stringify(allJunkIds, null, 2))
  }
}

identifyJunk()
