/**
 * Analyze All Work Items Sources
 *
 * Shows breakdown of how work items were created
 *
 * Run: npx tsx scripts/analyze-all-work-items-sources.ts
 */

import { config } from 'dotenv'
import { resolve } from 'path'
import { createClient } from '@supabase/supabase-js'

config({ path: resolve(process.cwd(), '.env.local') })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

const supabase = createClient(supabaseUrl, supabaseServiceKey)

async function analyzeWorkItems() {
  console.log('🔍 Analyzing all work items...\n')

  // Get all open work items
  const { data: allItems, error } = await supabase
    .from('work_items')
    .select('id, customer_name, customer_email, title, status, source, type, created_at, reason_included, closed_at')
    .is('closed_at', null)
    .order('created_at', { ascending: false })

  if (error) {
    console.error('Error fetching work items:', error)
    process.exit(1)
  }

  console.log(`Total open work items: ${allItems?.length || 0}\n`)

  // Group by source
  const bySource = new Map<string, any[]>()
  const byDetection = new Map<string, any[]>()
  const byStatus = new Map<string, any[]>()

  for (const item of allItems || []) {
    // By source
    const source = item.source || 'unknown'
    if (!bySource.has(source)) {
      bySource.set(source, [])
    }
    bySource.get(source)!.push(item)

    // By detection method
    const reasonIncluded = item.reason_included as any
    const detectedVia = reasonIncluded?.detected_via || 'manual'
    if (!byDetection.has(detectedVia)) {
      byDetection.set(detectedVia, [])
    }
    byDetection.get(detectedVia)!.push(item)

    // By status
    const status = item.status || 'unknown'
    if (!byStatus.has(status)) {
      byStatus.set(status, [])
    }
    byStatus.get(status)!.push(item)
  }

  console.log('='.repeat(80))
  console.log('📊 BY SOURCE')
  console.log('='.repeat(80))
  for (const [source, items] of Array.from(bySource.entries()).sort((a, b) => b[1].length - a[1].length)) {
    console.log(`${source}: ${items.length} items`)
  }

  console.log('\n' + '='.repeat(80))
  console.log('📊 BY DETECTION METHOD')
  console.log('='.repeat(80))
  for (const [method, items] of Array.from(byDetection.entries()).sort((a, b) => b[1].length - a[1].length)) {
    console.log(`${method}: ${items.length} items`)

    // Show samples for auto-created
    if (method === 'auto_lead_primary_category' || method === 'form_email_parser') {
      console.log('  Samples:')
      items.slice(0, 5).forEach(item => {
        console.log(`    - ${item.customer_email || 'No email'}`)
        console.log(`      Subject: ${item.title || 'N/A'}`)
        console.log(`      Status: ${item.status}`)
        console.log(`      ID: ${item.id}`)
      })
      if (items.length > 5) {
        console.log(`    ... and ${items.length - 5} more`)
      }
      console.log()
    }
  }

  console.log('\n' + '='.repeat(80))
  console.log('📊 BY STATUS')
  console.log('='.repeat(80))
  for (const [status, items] of Array.from(byStatus.entries()).sort((a, b) => b[1].length - a[1].length)) {
    console.log(`${status}: ${items.length} items`)
  }

  // Find suspicious patterns
  console.log('\n' + '='.repeat(80))
  console.log('🚩 SUSPICIOUS PATTERNS')
  console.log('='.repeat(80))

  const systemEmails = allItems?.filter(item => {
    const email = item.customer_email?.toLowerCase() || ''
    return email.includes('noreply') ||
           email.includes('notifications') ||
           email.includes('@shopify') ||
           email.includes('@paypal') ||
           email.includes('@stripe')
  }) || []

  if (systemEmails.length > 0) {
    console.log(`\n⚠️  System/notification emails (${systemEmails.length}):`)
    systemEmails.slice(0, 10).forEach(item => {
      console.log(`   - ${item.customer_email}`)
      console.log(`     Subject: ${item.title}`)
      console.log(`     Status: ${item.status} | Source: ${item.source}`)
      console.log(`     Detection: ${item.reason_included?.detected_via || 'manual'}`)
      console.log(`     ID: ${item.id}`)
    })
    if (systemEmails.length > 10) {
      console.log(`   ... and ${systemEmails.length - 10} more`)
    }
  }

  const personalEmails = allItems?.filter(item => {
    const email = item.customer_email?.toLowerCase() || ''
    const title = item.title?.toLowerCase() || ''
    const hasPersonalDomain = /@gmail\.com$|@yahoo\.com$|@hotmail\.com$|@outlook\.com$|@icloud\.com$|@me\.com$/i.test(email)
    const hasInquiryLanguage = /\b(quote|pricing|interested|custom|order|question|inquiry)\b/i.test(title)
    return hasPersonalDomain && !hasInquiryLanguage
  }) || []

  if (personalEmails.length > 0) {
    console.log(`\n⚠️  Personal emails without inquiry language (${personalEmails.length}):`)
    personalEmails.slice(0, 10).forEach(item => {
      console.log(`   - ${item.customer_email}`)
      console.log(`     Subject: ${item.title}`)
      console.log(`     Status: ${item.status} | Source: ${item.source}`)
      console.log(`     Detection: ${item.reason_included?.detected_via || 'manual'}`)
      console.log(`     ID: ${item.id}`)
    })
    if (personalEmails.length > 10) {
      console.log(`   ... and ${personalEmails.length - 10} more`)
    }
  }

  const oldNewInquiries = allItems?.filter(item => {
    if (item.status !== 'new_inquiry') return false
    const daysSince = Math.floor((Date.now() - new Date(item.created_at).getTime()) / (1000 * 60 * 60 * 24))
    return daysSince > 30
  }) || []

  if (oldNewInquiries.length > 0) {
    console.log(`\n⏰ Stuck in new_inquiry >30 days (${oldNewInquiries.length}):`)
    oldNewInquiries.slice(0, 10).forEach(item => {
      const daysSince = Math.floor((Date.now() - new Date(item.created_at).getTime()) / (1000 * 60 * 60 * 24))
      console.log(`   - ${item.customer_email || 'No email'}`)
      console.log(`     Subject: ${item.title}`)
      console.log(`     Age: ${daysSince} days | Source: ${item.source}`)
      console.log(`     Detection: ${item.reason_included?.detected_via || 'manual'}`)
      console.log(`     ID: ${item.id}`)
    })
    if (oldNewInquiries.length > 10) {
      console.log(`   ... and ${oldNewInquiries.length - 10} more`)
    }
  }

  console.log('\n' + '='.repeat(80))
}

analyzeWorkItems()
