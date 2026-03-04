/**
 * Test script to check Customify files and run backfill
 * Run with: npx tsx scripts/test-backfill.ts
 */

import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

async function main() {
  const supabase = createClient(supabaseUrl, supabaseKey)

  console.log('🔍 Checking for Customify files to backfill...\n')

  // Get all files that need backfilling
  const { data: customifyFiles, error } = await supabase
    .from('files')
    .select('id, work_item_id, storage_bucket, storage_path, original_filename, kind, external_url')
    .eq('storage_bucket', 'customify')
    .order('created_at', { ascending: true })

  if (error) {
    console.error('❌ Error fetching files:', error)
    return
  }

  console.log(`Found ${customifyFiles?.length || 0} Customify files to backfill\n`)

  if (customifyFiles && customifyFiles.length > 0) {
    console.log('Files to backfill:')
    customifyFiles.forEach((file, i) => {
      console.log(`  ${i + 1}. ${file.original_filename} (${file.kind}) - Work Item: ${file.work_item_id}`)
      console.log(`     URL: ${file.storage_path}`)
    })

    console.log('\n📥 Running backfill...\n')

    // Run the backfill endpoint
    const response = await fetch('http://localhost:3000/api/backfill-files', {
      method: 'POST',
    })

    const result = await response.json()
    console.log('Backfill results:')
    console.log(JSON.stringify(result, null, 2))

    if (result.successful > 0) {
      console.log(`\n✅ Successfully backfilled ${result.successful} files`)
    }
    if (result.failed > 0) {
      console.log(`\n❌ Failed to backfill ${result.failed} files`)
      if (result.errors && result.errors.length > 0) {
        console.log('\nErrors:')
        result.errors.forEach((err: any) => {
          console.log(`  - File ${err.fileId}: ${err.error}`)
        })
      }
    }
  } else {
    console.log('✅ No files need backfilling - all files are already in Supabase Storage!')
  }
}

main().catch(console.error)
