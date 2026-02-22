/**
 * Apply Lead-Focused System Migration
 * Runs the new migration on the live database
 */

import { config } from 'dotenv'
import { resolve } from 'path'
import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'fs'

config({ path: resolve(process.cwd(), '.env.local') })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

async function main() {
  console.log('🚀 Applying Lead-Focused System Migration...\n')

  // Read the migration file
  const migrationSQL = readFileSync(
    resolve(process.cwd(), 'supabase/migrations/20260222000001_lead_focused_system.sql'),
    'utf-8'
  )

  // Execute the migration
  const { data, error } = await supabase.rpc('exec_sql', { sql: migrationSQL })

  if (error) {
    console.error('❌ Migration failed:', error)
    process.exit(1)
  }

  console.log('✅ Migration applied successfully!')
  console.log('\nNext steps:')
  console.log('1. Build the new Dashboard UI')
  console.log('2. Build the Lead Detail page')
  console.log('3. Add Internal Notes components')
  console.log('4. Update navigation\n')
}

main()
