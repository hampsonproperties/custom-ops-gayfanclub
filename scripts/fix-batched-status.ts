/**
 * Fix Batched Custom Projects Status
 *
 * Updates assisted_project items that are batched
 * but stuck in earlier statuses to "batched" status
 *
 * Run: npx tsx scripts/fix-batched-status.ts
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

async function fixBatchedStatus() {
  console.log('🔍 Finding batched custom projects with incorrect status...\n')

  // Find assisted_project items that are batched but not in correct status
  const { data: batchedProjects, error } = await supabase
    .from('work_items')
    .select('id, title, status, customer_name, batched_at, batch_id, closed_at')
    .eq('type', 'assisted_project')
    .not('batched_at', 'is', null)
    .not('status', 'in', '(batched,shipped,delivered,completed)')
    .is('closed_at', null) // Only open items
    .order('batched_at', { ascending: false })

  if (error) {
    console.error('❌ Error fetching batched projects:', error)
    process.exit(1)
  }

  if (!batchedProjects || batchedProjects.length === 0) {
    console.log('✅ No batched custom projects found with incorrect status')

    // Also check if there are closed batched items
    const { data: closedBatched } = await supabase
      .from('work_items')
      .select('id, title, status, customer_name, batched_at, closed_at')
      .eq('type', 'assisted_project')
      .not('batched_at', 'is', null)
      .not('closed_at', 'is', null)
      .limit(10)

    if (closedBatched && closedBatched.length > 0) {
      console.log(`\n⚠️  Found ${closedBatched.length} CLOSED batched items (these won't show Change Status button):`)
      closedBatched.forEach(item => {
        console.log(`   - ${item.customer_name} (Status: ${item.status}, Closed: ${new Date(item.closed_at!).toLocaleDateString()})`)
      })
    }

    return
  }

  console.log(`Found ${batchedProjects.length} batched custom projects needing status update:\n`)

  // Show what will be updated
  batchedProjects.forEach((project, i) => {
    console.log(`${i + 1}. ${project.customer_name || 'Unknown'}`)
    console.log(`   Current Status: ${project.status}`)
    console.log(`   New Status: batched`)
    console.log(`   Batched: ${new Date(project.batched_at!).toLocaleDateString()}`)
    console.log()
  })

  console.log('\n⚠️  This will update all items above to "batched" status.')
  console.log('Press Ctrl+C to cancel, or wait 5 seconds to continue...\n')

  await new Promise(resolve => setTimeout(resolve, 5000))

  console.log('Updating...\n')

  let updated = 0
  let failed = 0

  for (const project of batchedProjects) {
    try {
      const { error: updateError } = await supabase
        .from('work_items')
        .update({ status: 'batched' })
        .eq('id', project.id)

      if (updateError) {
        console.error(`❌ Failed to update ${project.customer_name}:`, updateError.message)
        failed++
      } else {
        console.log(`✅ Updated ${project.customer_name} to "batched"`)
        updated++
      }
    } catch (err) {
      console.error(`❌ Error updating ${project.customer_name}:`, err)
      failed++
    }
  }

  console.log('\n' + '='.repeat(60))
  console.log('📊 UPDATE COMPLETE')
  console.log('='.repeat(60))
  console.log(`✅ Successfully updated: ${updated}`)
  console.log(`❌ Failed: ${failed}`)
  console.log('='.repeat(60))
}

async function main() {
  try {
    await fixBatchedStatus()
  } catch (error) {
    console.error('\n❌ Fatal error:', error)
    process.exit(1)
  }
}

main()
