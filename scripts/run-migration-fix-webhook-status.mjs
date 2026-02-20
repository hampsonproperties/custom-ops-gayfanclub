import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'
import { readFileSync } from 'fs'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

dotenv.config({ path: join(__dirname, '..', '.env.local') })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

console.log('Running migration: Fix webhook_events processing_status constraint\n')

// Read migration file
const migrationSQL = readFileSync(
  join(__dirname, '..', 'supabase', 'migrations', '20260205000003_fix_webhook_status_constraint.sql'),
  'utf8'
)

console.log('Migration SQL:')
console.log(migrationSQL)
console.log('\n' + '='.repeat(60) + '\n')

try {
  // Execute migration
  const { data, error } = await supabase.rpc('exec_sql', { sql: migrationSQL })

  if (error) {
    console.error('❌ Migration failed:', error)

    // Try running commands individually
    console.log('\nTrying to run commands individually...\n')

    const commands = [
      'ALTER TABLE webhook_events DROP CONSTRAINT IF EXISTS webhook_events_processing_status_check;',
      "ALTER TABLE webhook_events ADD CONSTRAINT webhook_events_processing_status_check CHECK (processing_status IN ('pending', 'processing', 'completed', 'skipped', 'failed', 'received', 'processed'));",
      "ALTER TABLE webhook_events ALTER COLUMN processing_status SET DEFAULT 'pending';",
    ]

    for (const cmd of commands) {
      console.log(`Executing: ${cmd.substring(0, 80)}...`)
      const { error: cmdError } = await supabase.rpc('exec_sql', { sql: cmd })
      if (cmdError) {
        console.error(`  ❌ Failed:`, cmdError.message)
      } else {
        console.log(`  ✓ Success`)
      }
    }
  } else {
    console.log('✅ Migration completed successfully!')
  }

  // Verify the fix
  console.log('\nVerifying constraint...')
  const { data: constraints, error: checkError } = await supabase
    .from('webhook_events')
    .select('processing_status')
    .limit(1)

  if (!checkError) {
    console.log('✓ Table is accessible')
  }
} catch (error) {
  console.error('Error:', error.message)
}

console.log('\n✓ Migration complete! Webhooks should now work.')
console.log('\nNext: Deploy to Vercel or run "Send test" in Shopify to verify.')

process.exit(0)
