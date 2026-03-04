/**
 * Check Custom Projects that are Batched but Stuck
 *
 * Finds assisted_project work items that have batched_at set
 * but are still in earlier statuses instead of 'batched' or 'shipped'
 *
 * Run: npx tsx scripts/check-batched-custom-projects.ts
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

async function checkBatchedCustomProjects() {
  console.log('🔍 Checking for batched custom projects with incorrect status...\n')

  // Find assisted_project items that are batched but not in correct status
  const { data: batchedProjects, error } = await supabase
    .from('work_items')
    .select('id, title, status, customer_name, customer_email, batched_at, batch_id, shopify_order_number')
    .eq('type', 'assisted_project')
    .not('batched_at', 'is', null)
    .not('status', 'in', '(batched,shipped,delivered,completed)')
    .is('closed_at', null)
    .order('batched_at', { ascending: false })

  if (error) {
    console.error('❌ Error fetching batched projects:', error)
    process.exit(1)
  }

  if (!batchedProjects || batchedProjects.length === 0) {
    console.log('✅ No batched custom projects found with incorrect status')
    return
  }

  console.log(`Found ${batchedProjects.length} batched custom projects with incorrect status:\n`)

  // Group by current status
  const statusGroups = new Map<string, typeof batchedProjects>()
  for (const project of batchedProjects) {
    if (!statusGroups.has(project.status)) {
      statusGroups.set(project.status, [])
    }
    statusGroups.get(project.status)!.push(project)
  }

  // Display grouped by status
  for (const [status, projects] of statusGroups.entries()) {
    console.log(`\n📦 Status: "${status}" (${projects.length} items)`)
    console.log('─'.repeat(80))

    for (const project of projects) {
      console.log(`  ID: ${project.id}`)
      console.log(`  Title: ${project.title || 'Untitled'}`)
      console.log(`  Customer: ${project.customer_name} (${project.customer_email})`)
      console.log(`  Order: ${project.shopify_order_number || 'N/A'}`)
      console.log(`  Batched: ${new Date(project.batched_at!).toLocaleDateString()}`)
      console.log(`  Batch ID: ${project.batch_id || 'N/A'}`)
      console.log()
    }
  }

  console.log('\n' + '='.repeat(80))
  console.log('📊 SUMMARY')
  console.log('='.repeat(80))
  console.log(`Total batched items needing status update: ${batchedProjects.length}`)
  console.log('\nStatus breakdown:')
  for (const [status, projects] of statusGroups.entries()) {
    console.log(`  - ${status}: ${projects.length}`)
  }

  console.log('\n💡 To fix these, you can:')
  console.log('   1. Run the update script to automatically move them to "batched" status')
  console.log('   2. Manually update them in the UI')
  console.log('\nWould you like to create an update script? (y/n)')
}

async function main() {
  try {
    await checkBatchedCustomProjects()
  } catch (error) {
    console.error('\n❌ Fatal error:', error)
    process.exit(1)
  }
}

main()
