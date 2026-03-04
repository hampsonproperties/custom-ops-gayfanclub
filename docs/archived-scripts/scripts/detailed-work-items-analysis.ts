/**
 * Detailed Work Items Analysis
 * Let's see what's actually in those 97 open work items
 */

import { config } from 'dotenv'
import { resolve } from 'path'
import { createClient } from '@supabase/supabase-js'

config({ path: resolve(process.cwd(), '.env.local') })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

async function main() {
  console.log('🔍 DETAILED WORK ITEMS ANALYSIS\n')

  // Get ALL open work items with details
  const { data: workItems } = await supabase
    .from('work_items')
    .select('id, customer_name, customer_email, title, status, source, created_at, reason_included, last_contact_at')
    .is('closed_at', null)
    .order('created_at', { ascending: false })

  console.log(`Total open work items: ${workItems?.length}\n`)

  // Group by how they were created
  console.log('📥 HOW WERE WORK ITEMS CREATED?')
  console.log('-'.repeat(80))

  const bySource = workItems?.reduce((acc: any, item) => {
    const detectedVia = item.reason_included?.detected_via || 'unknown'
    const key = `${item.source} (${detectedVia})`
    if (!acc[key]) acc[key] = []
    acc[key].push(item)
    return acc
  }, {})

  for (const [source, items] of Object.entries(bySource || {})) {
    console.log(`\n${source}: ${(items as any).length} items`)
    // Show first 3 examples
    for (const item of (items as any).slice(0, 3)) {
      console.log(`  - ${item.customer_name} (${item.customer_email})`)
      console.log(`    "${item.title}"`)
    }
  }

  // Check for patterns that look like real customers vs junk
  console.log('\n\n🎯 REAL vs POTENTIAL JUNK')
  console.log('-'.repeat(80))

  const realCustomers = workItems?.filter(item =>
    !item.customer_email?.includes('noreply') &&
    !item.customer_email?.includes('no-reply') &&
    !item.customer_email?.includes('notifications') &&
    !item.customer_email?.includes('@shopify') &&
    !item.customer_email?.includes('@stripe') &&
    !item.customer_email?.includes('@paypal') &&
    !item.customer_email?.includes('unknown@unknown') &&
    item.customer_email?.includes('@') // has valid email
  )

  const potentialJunk = workItems?.filter(item =>
    item.customer_email?.includes('noreply') ||
    item.customer_email?.includes('no-reply') ||
    item.customer_email?.includes('notifications') ||
    item.customer_email?.includes('@shopify') ||
    item.customer_email?.includes('@stripe') ||
    item.customer_email?.includes('@paypal') ||
    item.customer_email?.includes('unknown@unknown')
  )

  console.log(`✅ Real customers: ${realCustomers?.length}`)
  console.log(`❌ Potential junk: ${potentialJunk?.length}`)

  if (potentialJunk && potentialJunk.length > 0) {
    console.log('\nPotential junk work items:')
    for (const item of potentialJunk) {
      console.log(`  ❌ ${item.customer_email} | ${item.status} | ${item.reason_included?.detected_via}`)
    }
  }

  // Look at status distribution for real customers only
  console.log('\n\n📊 REAL CUSTOMER STATUS BREAKDOWN')
  console.log('-'.repeat(80))

  const realStatusBreakdown = realCustomers?.reduce((acc: any, item) => {
    acc[item.status] = (acc[item.status] || 0) + 1
    return acc
  }, {})

  console.table(realStatusBreakdown)

  // Show new_inquiry items (these are the active leads)
  console.log('\n🆕 NEW INQUIRIES (Active Sales Leads)')
  console.log('-'.repeat(80))

  const newInquiries = realCustomers?.filter(item => item.status === 'new_inquiry')
  console.log(`Total: ${newInquiries?.length}\n`)

  for (const item of (newInquiries || []).slice(0, 10)) {
    const age = Math.floor((new Date().getTime() - new Date(item.created_at).getTime()) / (1000 * 60 * 60 * 24))
    const lastContact = item.last_contact_at
      ? Math.floor((new Date().getTime() - new Date(item.last_contact_at).getTime()) / (1000 * 60 * 60 * 24))
      : null

    console.log(`  📧 ${item.customer_name}`)
    console.log(`     ${item.customer_email}`)
    console.log(`     "${item.title}"`)
    console.log(`     Age: ${age} days | Last contact: ${lastContact ? lastContact + ' days ago' : 'never'}`)
    console.log()
  }

  console.log('\n✅ Analysis complete!')
}

main()
