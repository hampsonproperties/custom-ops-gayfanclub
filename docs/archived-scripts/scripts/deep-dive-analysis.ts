/**
 * Deep Dive Analysis - Actual Database Inspection
 *
 * This queries the real database to understand:
 * 1. What emails are actually in there
 * 2. How many are junk vs real
 * 3. What work items exist
 * 4. Current pain points with data
 */

import { config } from 'dotenv'
import { resolve } from 'path'
import { createClient } from '@supabase/supabase-js'

config({ path: resolve(process.cwd(), '.env.local') })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing required environment variables')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseServiceKey)

async function main() {
  console.log('🔍 DEEP DIVE DATABASE ANALYSIS\n')
  console.log('=' .repeat(80))

  // 1. Work Items by Status
  console.log('\n📊 WORK ITEMS BY STATUS')
  console.log('-'.repeat(80))
  const { data: statusCounts } = await supabase
    .from('work_items')
    .select('status, closed_at')
    .is('closed_at', null)

  const statusBreakdown = statusCounts?.reduce((acc: any, item) => {
    acc[item.status] = (acc[item.status] || 0) + 1
    return acc
  }, {})

  console.table(statusBreakdown)

  // 2. Communications by Category
  console.log('\n📧 EMAILS BY CATEGORY')
  console.log('-'.repeat(80))
  const { data: categoryCounts } = await supabase
    .from('communications')
    .select('category, direction')

  const categoryBreakdown = categoryCounts?.reduce((acc: any, item) => {
    const key = `${item.category} (${item.direction})`
    acc[key] = (acc[key] || 0) + 1
    return acc
  }, {})

  console.table(categoryBreakdown)

  // 3. Primary emails WITHOUT work items (potentially lost leads)
  console.log('\n🚨 PRIMARY EMAILS WITHOUT WORK ITEMS (Potentially Lost Leads)')
  console.log('-'.repeat(80))
  const { data: unlinkedPrimary } = await supabase
    .from('communications')
    .select('from_email, from_name, subject, received_at')
    .eq('category', 'primary')
    .eq('direction', 'inbound')
    .is('work_item_id', null)
    .order('received_at', { ascending: false })
    .limit(20)

  console.log(`Total unlinked primary emails (first 20 shown):`)
  if (unlinkedPrimary) {
    for (const email of unlinkedPrimary) {
      const isJunk =
        email.from_email.includes('noreply') ||
        email.from_email.includes('no-reply') ||
        email.from_email.includes('notifications') ||
        email.from_email.includes('paypal') ||
        email.from_email.includes('stripe') ||
        email.from_email.includes('shopify')

      const flag = isJunk ? '❌ JUNK' : '✅ REAL?'
      console.log(`  ${flag} | ${email.from_name || email.from_email} | ${email.subject?.substring(0, 50)}`)
    }
  }

  // 4. Work items that look like junk
  console.log('\n🗑️  WORK ITEMS THAT LOOK LIKE JUNK')
  console.log('-'.repeat(80))
  const { data: junkWorkItems } = await supabase
    .from('work_items')
    .select('customer_email, customer_name, status, created_at, reason_included')
    .is('closed_at', null)
    .or('customer_email.ilike.%noreply%,customer_email.ilike.%paypal%,customer_email.ilike.%stripe%,customer_email.ilike.%shopify%,customer_email.ilike.%notifications%,customer_email.ilike.%apple.com%')
    .limit(20)

  console.log(`Found ${junkWorkItems?.length || 0} junk work items (sample):`)
  if (junkWorkItems) {
    for (const item of junkWorkItems) {
      const source = item.reason_included?.detected_via || 'unknown'
      console.log(`  📧 ${item.customer_email} | ${item.status} | Created by: ${source}`)
    }
  }

  // 5. Real customer inquiries (forms + valid emails)
  console.log('\n✅ REAL CUSTOMER WORK ITEMS (from forms)')
  console.log('-'.repeat(80))
  const { data: formLeads } = await supabase
    .from('work_items')
    .select('customer_email, customer_name, status, created_at, source')
    .eq('source', 'form')
    .is('closed_at', null)
    .order('created_at', { ascending: false })
    .limit(10)

  console.log(`Found ${formLeads?.length || 0} form submissions (first 10):`)
  if (formLeads) {
    for (const item of formLeads) {
      console.log(`  📝 ${item.customer_name} (${item.customer_email}) | ${item.status}`)
    }
  }

  // 6. Emails by sender frequency (top emailers)
  console.log('\n📬 TOP EMAIL SENDERS (Who emails you the most?)')
  console.log('-'.repeat(80))
  const { data: allEmails } = await supabase
    .from('communications')
    .select('from_email, from_name')
    .eq('direction', 'inbound')

  const senderCounts = allEmails?.reduce((acc: any, email) => {
    acc[email.from_email] = (acc[email.from_email] || 0) + 1
    return acc
  }, {})

  const topSenders = Object.entries(senderCounts || {})
    .sort(([, a]: any, [, b]: any) => b - a)
    .slice(0, 20)

  for (const [email, count] of topSenders) {
    const isJunk =
      (email as string).includes('noreply') ||
      (email as string).includes('notifications') ||
      (email as string).includes('paypal') ||
      (email as string).includes('stripe')
    const flag = isJunk ? '🗑️' : '📧'
    console.log(`  ${flag} ${count} emails from: ${email}`)
  }

  // 7. Conversations summary
  console.log('\n💬 CONVERSATIONS SUMMARY')
  console.log('-'.repeat(80))
  const { data: conversations } = await supabase
    .from('conversations')
    .select('status, message_count, has_unread')

  const convBreakdown = {
    active: conversations?.filter(c => c.status === 'active').length || 0,
    resolved: conversations?.filter(c => c.status === 'resolved').length || 0,
    archived: conversations?.filter(c => c.status === 'archived').length || 0,
    with_unread: conversations?.filter(c => c.has_unread).length || 0,
  }

  console.table(convBreakdown)

  // 8. Quick stats summary
  console.log('\n📈 QUICK STATS SUMMARY')
  console.log('='.repeat(80))

  const { count: totalEmails } = await supabase
    .from('communications')
    .select('*', { count: 'exact', head: true })

  const { count: totalWorkItems } = await supabase
    .from('work_items')
    .select('*', { count: 'exact', head: true })

  const { count: openWorkItems } = await supabase
    .from('work_items')
    .select('*', { count: 'exact', head: true })
    .is('closed_at', null)

  const { count: primaryUnlinked } = await supabase
    .from('communications')
    .select('*', { count: 'exact', head: true })
    .eq('category', 'primary')
    .eq('direction', 'inbound')
    .is('work_item_id', null)

  console.log(`Total emails imported: ${totalEmails}`)
  console.log(`Total work items: ${totalWorkItems}`)
  console.log(`Open work items: ${openWorkItems}`)
  console.log(`Primary emails without work item: ${primaryUnlinked} ⚠️`)

  console.log('\n✅ Analysis complete!')
}

main()
