/**
 * Breakdown Open Items by Status
 *
 * Shows what statuses make up your open work items list
 */

import { config } from 'dotenv'
import { resolve } from 'path'
import { createClient } from '@supabase/supabase-js'

config({ path: resolve(process.cwd(), '.env.local') })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

async function breakdown() {
  const { data: openItems } = await supabase
    .from('work_items')
    .select('*')
    .is('closed_at', null)
    .order('created_at', { ascending: false })

  console.log(`Total open items: ${openItems?.length || 0}\n`)

  // Group by status
  const byStatus = new Map<string, any[]>()
  for (const item of openItems || []) {
    if (!byStatus.has(item.status)) {
      byStatus.set(item.status, [])
    }
    byStatus.get(item.status)!.push(item)
  }

  console.log('📊 BREAKDOWN BY STATUS:\n')

  // Sort by count
  const sorted = Array.from(byStatus.entries()).sort((a, b) => b[1].length - a[1].length)

  for (const [status, items] of sorted) {
    console.log(`${status}: ${items.length}`)

    // Show first 3 examples
    items.slice(0, 3).forEach(item => {
      const daysSince = Math.floor((Date.now() - new Date(item.created_at).getTime()) / (1000 * 60 * 60 * 24))
      console.log(`  - ${item.customer_name || item.customer_email || 'Unknown'} (${daysSince}d ago)`)
    })

    if (items.length > 3) {
      console.log(`  ... and ${items.length - 3} more`)
    }
    console.log()
  }

  console.log('\n💡 WHICH STATUSES DO YOU WANT TO HIDE?')
  console.log('   Common ones to filter out:')
  console.log('   - batched (already in production)')
  console.log('   - shipped (already done)')
  console.log('   - old new_inquiry (dead leads)')
}

breakdown()
