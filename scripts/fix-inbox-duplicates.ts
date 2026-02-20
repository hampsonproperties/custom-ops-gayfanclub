/**
 * Fix duplicate inbox replies - delete duplicates and add constraint
 */

import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'
import { resolve } from 'path'

config({ path: resolve(process.cwd(), '.env.local') })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

async function fixDuplicates() {
  const supabase = createClient(supabaseUrl, supabaseServiceKey)

  console.log(`\n🔧 Fixing duplicate inbox replies...\n`)

  // Step 1: Delete duplicates (keep oldest)
  console.log('Step 1: Deleting duplicate emails...')

  const deleteQuery = `
    DELETE FROM communications
    WHERE id IN (
      SELECT c2.id
      FROM communications c1
      INNER JOIN communications c2
        ON c1.internet_message_id = c2.internet_message_id
        AND c1.internet_message_id IS NOT NULL
      WHERE c1.created_at < c2.created_at
        OR (c1.created_at = c2.created_at AND c1.id < c2.id)
    )
  `

  // Note: We can't run raw SQL directly via the client, so let's do it via
  // the delete API with individual IDs from our earlier script output

  const duplicateIds = [
    '9dbdf91b-ddbf-4793-8c02-7e2dac32ad7c',
    'f17f0476-abda-40a5-9182-2bcc639e7018',
    'f78f6298-29af-45cc-a689-670180f8a932',
    'a3e96f85-1f54-43e0-bfa9-55d18e5f403e',
    'd196dbfa-2f08-4d10-b16a-c29d89e8fad4',
    '49034466-ccb7-4066-ae03-808509cc48fe',
    '6c15e7a8-93bd-46d3-9fea-02f163c39b38',
    '449b53b1-f609-4620-bfa6-a5c9b9f607bf',
    '7f513aa8-66ad-432b-9e17-25d5e02f1d1d',
    '8e5f5e8b-f3c2-484f-924b-c3f3a39b6f67',
    'f93b6df0-be58-49d2-8890-f894fe100e12',
    'c2a78fd9-41e9-474e-91d1-b3b7e347c557',
    'dcb9ac3b-8fc0-4661-9ec0-ea044987d817',
    'fac0d3a8-e232-4e72-ace8-a76984fe336e',
    'c05696de-81e5-4a43-9b32-c74a09ddbbe2',
    '1659d5ce-7508-4fc8-ad20-f2f47084fc6e',
    'fb90879f-a618-44ea-bc14-a15df9d310a4',
    '557610fe-583e-4664-915e-c510437ab5b1',
    '6fcecd2b-ae70-4691-ac3d-d271a4e1d918',
    '6f6055ee-ab78-4d61-8166-3c1e1e05976b',
    '7b7faeb8-f939-4987-bf51-1d01919c29f4',
    '27ed24a9-1dca-4e43-a649-1d714a337d27',
    '5ab8ce7a-2578-4554-8d4a-c3877cf30ce5',
    'a7b287b4-c667-4f34-adc1-602302e3e418',
    '2f508501-de42-4c74-aee0-1ae8a240c475',
    '8e6a17d7-a8ee-4af1-a872-d0799eb06781',
    'c8fb7765-4a4b-4e60-a10a-dc37e9e3864b',
    'dee8adc2-e452-4744-9c8e-d1c70108eeed',
    '4060a552-06fe-476a-8e9c-6ab552c46f22',
    'ebb94144-1abd-4f67-9fa8-f95d92edb892',
    'ee065f61-b929-429d-b0b7-f461f65ebb59',
    '78e782ec-34dc-4723-a95f-4a633ce7d9d9',
    'f51cbee9-05ee-479b-ad35-3e57b8254ab4',
    'f28b24c2-116b-427b-a706-bcf466dd59d3',
    'deaf866c-57d2-45bc-91b6-d106dc43dfd7',
    'ecb0f900-dc89-4d92-843d-65110203f433',
    '6153144c-5768-4f14-845f-2cb214a4fff4',
    '3ab4c472-47b6-4046-98f0-947e70ff67ba',
    'e392ac22-8a03-4265-99d8-dc1ad1c01972',
  ]

  console.log(`Deleting ${duplicateIds.length} duplicate emails...`)

  const { error: deleteError } = await supabase
    .from('communications')
    .delete()
    .in('id', duplicateIds)

  if (deleteError) {
    console.error('❌ Error deleting duplicates:', deleteError)
  } else {
    console.log(`✅ Deleted ${duplicateIds.length} duplicate emails`)
  }

  // Step 2: Check inbox replies count
  const { data: afterCount } = await supabase
    .from('communications')
    .select('id', { count: 'exact', head: true })
    .eq('direction', 'inbound')
    .is('actioned_at', null)
    .not('work_item_id', 'is', null)

  console.log(`\n📊 Inbox replies after cleanup: ${afterCount?.length || 0}`)
  console.log(`   (Should be around 60-70 instead of 117)`)

  console.log(`\n✅ Cleanup complete!`)
  console.log(`\n💡 Next: You need to add UNIQUE constraint in Supabase dashboard:`)
  console.log(`   1. Go to Supabase SQL Editor`)
  console.log(`   2. Run this SQL:`)
  console.log(``)
  console.log(`   ALTER TABLE communications`)
  console.log(`   ADD CONSTRAINT uq_communications_message_id`)
  console.log(`   UNIQUE (internet_message_id);`)
  console.log(``)
  console.log(`   This will prevent future duplicates!`)
}

fixDuplicates().catch(console.error)
