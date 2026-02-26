/**
 * Close Junk Leads
 *
 * Closes the 17 identified junk work items
 *
 * Run: npx tsx scripts/close-junk-leads.ts
 */

import { config } from 'dotenv'
import { resolve } from 'path'
import { createClient } from '@supabase/supabase-js'

config({ path: resolve(process.cwd(), '.env.local') })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

const supabase = createClient(supabaseUrl, supabaseServiceKey)

// The 17 junk IDs identified
const JUNK_IDS = [
  '0ae484c2-7170-4511-836f-6f010a13b683',
  'e25f46c8-b58c-446e-9c07-cdca3432b36e',
  'f132dd25-fbb6-42cf-920f-d55f48068a58',
  '2c2ac64e-a5fc-4750-bbab-719abd71b76f',
  '52693676-de06-47de-9621-4dcd1fcc54e1',
  '7b3849f8-4f3b-46d8-bbef-4af3803d024c',
  '50120bca-b868-406d-bcfe-573e598a2009',
  '8b238a3f-dbe3-456d-b8bb-16b35713b043',
  '31cdc3f9-6dfe-4f1a-9d33-e3dccb0a8a3b',
  'b5779e9a-1f98-45e1-a0ae-67321278ef4d',
  '4f4db09c-8fed-4019-b783-b0e71137b378',
  '77b6ebd5-54bf-46f6-b33c-582b31975353',
  'e04775f9-8667-4846-a975-e8ef1e9e4316',
  '824f256a-55f0-420b-977a-c74705eec9c2',
  '718f03e6-dc12-4784-83d2-994e86ae8c0f',
  '09bb4312-b7ab-484d-83bc-aba0711423c1',
  '345b61db-910b-4ad9-b8bf-e497668b821b',
]

async function closeJunkLeads() {
  console.log('🗑️  Closing 17 junk leads...\n')

  // Get details before closing
  const { data: itemsToClose, error: fetchError } = await supabase
    .from('work_items')
    .select('id, customer_name, customer_email, title, status')
    .in('id', JUNK_IDS)

  if (fetchError) {
    console.error('Error fetching items:', fetchError)
    process.exit(1)
  }

  console.log('Items to close:')
  itemsToClose?.forEach((item, i) => {
    console.log(`${i + 1}. ${item.customer_email} - ${item.title}`)
  })

  console.log('\n' + '='.repeat(80))
  console.log('Closing items...')
  console.log('='.repeat(80) + '\n')

  // Close the work items
  const { error: closeError } = await supabase
    .from('work_items')
    .update({
      status: 'closed_lost',
      closed_at: new Date().toISOString(),
      close_reason: 'Auto-closed: Not a customer inquiry (system email, invitation, personal email, etc.)',
    })
    .in('id', JUNK_IDS)

  if (closeError) {
    console.error('❌ Error closing items:', closeError)
    process.exit(1)
  }

  console.log(`✅ Successfully closed ${JUNK_IDS.length} work items`)

  // Unlink communications
  console.log('\nUnlinking communications from closed leads...')

  const { error: unlinkError } = await supabase
    .from('communications')
    .update({ work_item_id: null, triage_status: 'untriaged' })
    .in('work_item_id', JUNK_IDS)

  if (unlinkError) {
    console.error('⚠️  Warning: Could not unlink communications:', unlinkError)
  } else {
    console.log('✅ Unlinked communications from closed leads')
  }

  console.log('\n' + '='.repeat(80))
  console.log('✅ CLEANUP COMPLETE')
  console.log('='.repeat(80))
  console.log(`Closed ${JUNK_IDS.length} junk leads`)
  console.log('\nYou can manually re-add any legitimate leads if needed.')
}

closeJunkLeads()
