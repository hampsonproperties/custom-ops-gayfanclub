/**
 * Analyze ALL Work Items (including closed)
 *
 * Get full stats on what's in the database
 */

import { config } from 'dotenv'
import { resolve } from 'path'
import { createClient } from '@supabase/supabase-js'

config({ path: resolve(process.cwd(), '.env.local') })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

const supabase = createClient(supabaseUrl, supabaseServiceKey)

async function analyzeAll() {
  console.log('🔍 Analyzing ALL work items...\n')

  // Get ALL items (open and closed)
  const { data: allItems, error } = await supabase
    .from('work_items')
    .select('id, customer_name, customer_email, status, type, source, created_at, closed_at')
    .order('created_at', { ascending: false })

  if (error) {
    console.error('Error:', error)
    process.exit(1)
  }

  const openItems = allItems?.filter(i => !i.closed_at) || []
  const closedItems = allItems?.filter(i => i.closed_at) || []

  console.log(`📊 TOTAL WORK ITEMS: ${allItems?.length || 0}`)
  console.log(`   - Open: ${openItems.length}`)
  console.log(`   - Closed: ${closedItems.length}\n`)

  // Breakdown by type
  const byType = new Map<string, number>()
  const byStatus = new Map<string, number>()
  const bySource = new Map<string, number>()

  for (const item of allItems || []) {
    byType.set(item.type, (byType.get(item.type) || 0) + 1)
    byStatus.set(item.status, (byStatus.get(item.status) || 0) + 1)
    bySource.set(item.source, (bySource.get(item.source) || 0) + 1)
  }

  console.log('📦 BY TYPE:')
  for (const [type, count] of byType.entries()) {
    console.log(`   ${type}: ${count}`)
  }

  console.log('\n📊 BY STATUS:')
  const sortedStatuses = Array.from(byStatus.entries()).sort((a, b) => b[1] - a[1])
  for (const [status, count] of sortedStatuses) {
    console.log(`   ${status}: ${count}`)
  }

  console.log('\n📍 BY SOURCE:')
  for (const [source, count] of bySource.entries()) {
    console.log(`   ${source}: ${count}`)
  }

  // Check for test data
  const testItems = allItems?.filter(item => {
    const name = item.customer_name?.toLowerCase() || ''
    const email = item.customer_email?.toLowerCase() || ''
    return (
      name.includes('test') ||
      email.includes('test') ||
      email.includes('example.com') ||
      email === 'alex@prideevents.org' ||
      email === 'sarah@wedding.com'
    )
  }) || []

  console.log(`\n🧪 TEST DATA: ${testItems.length} items`)
  if (testItems.length > 0) {
    testItems.forEach(item => {
      console.log(`   - ${item.customer_name || 'Unknown'} (${item.customer_email}) - ${item.closed_at ? 'CLOSED' : 'OPEN'}`)
    })
  }

  // Old closed items
  const veryOldClosed = closedItems.filter(item => {
    const closedDate = new Date(item.closed_at!)
    const daysSince = Math.floor((Date.now() - closedDate.getTime()) / (1000 * 60 * 60 * 24))
    return daysSince > 60
  })

  console.log(`\n🗑️  CLOSED >60 DAYS AGO: ${veryOldClosed.length} items`)
  console.log('   (These could be archived/deleted if not needed for reporting)')
}

analyzeAll()
