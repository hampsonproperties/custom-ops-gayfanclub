/**
 * Backfill Customer Names from Communications
 *
 * For work items without customer_name, try to extract names from their linked emails
 */

import { config } from 'dotenv'
import { resolve } from 'path'
import { createClient } from '@supabase/supabase-js'

config({ path: resolve(process.cwd(), '.env.local') })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

const supabase = createClient(supabaseUrl, supabaseServiceKey)

async function backfillNames() {
  console.log('🔍 Finding work items without customer names...\n')

  // Get work items without customer_name
  const { data: itemsWithoutNames, error } = await supabase
    .from('work_items')
    .select('id, customer_email, customer_name')
    .is('closed_at', null)
    .or('customer_name.is.null,customer_name.eq.')
    .limit(200)

  if (error) {
    console.error('Error:', error)
    process.exit(1)
  }

  console.log(`Found ${itemsWithoutNames?.length || 0} work items without names\n`)

  if (!itemsWithoutNames || itemsWithoutNames.length === 0) {
    console.log('✅ All work items have customer names!')
    return
  }

  let updated = 0
  let skipped = 0

  for (const item of itemsWithoutNames) {
    // Try to find a communication from this customer with a name
    const { data: comms } = await supabase
      .from('communications')
      .select('from_email, from_name')
      .eq('from_email', item.customer_email)
      .not('from_name', 'is', null)
      .neq('from_name', item.customer_email) // Exclude where name = email
      .limit(1)
      .maybeSingle()

    if (comms && comms.from_name) {
      // Update work item with the name
      const { error: updateError } = await supabase
        .from('work_items')
        .update({ customer_name: comms.from_name })
        .eq('id', item.id)

      if (!updateError) {
        console.log(`✅ ${item.customer_email} → ${comms.from_name}`)
        updated++
      } else {
        console.error(`❌ Error updating ${item.id}:`, updateError.message)
        skipped++
      }
    } else {
      skipped++
    }
  }

  console.log('\n' + '='.repeat(60))
  console.log('📊 RESULTS')
  console.log('='.repeat(60))
  console.log(`✅ Updated with names: ${updated}`)
  console.log(`⏭️  No name found: ${skipped}`)
  console.log(`📧 Total processed: ${itemsWithoutNames.length}`)
  console.log('='.repeat(60))

  if (skipped > 0) {
    console.log('\n💡 Items without names likely:')
    console.log('   - Email senders only provided email address (no display name)')
    console.log('   - Created from Shopify without customer name')
    console.log('   - Manual entries')
  }
}

backfillNames()
