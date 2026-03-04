/**
 * Migration Runner - Executes the 7 new migrations for Phase 1-3
 * Run with: npx tsx scripts/run-new-migrations.ts
 */

import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'fs'
import { join } from 'path'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

if (!supabaseUrl || !serviceRoleKey) {
  console.error('❌ Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
})

const MIGRATIONS = [
  '20260219000001_improve_email_deduplication.sql',
  '20260219000002_create_dead_letter_queue.sql',
  '20260219000003_create_stuck_items_views.sql',
  '20260219000004_create_email_filters.sql',
  '20260219000005_create_conversations_table.sql',
  '20260219000006_create_reminder_engine.sql',
  '20260219000007_create_quick_reply_templates.sql',
]

async function runMigration(filename: string): Promise<boolean> {
  console.log(`\n📄 Running migration: ${filename}`)

  try {
    const migrationPath = join(process.cwd(), 'supabase', 'migrations', filename)
    const sql = readFileSync(migrationPath, 'utf8')

    // Use Supabase's raw SQL execution via rpc
    // Note: This requires a custom SQL function to be created first
    const { error } = await supabase.rpc('exec_sql', { sql_string: sql })

    if (error) {
      console.error(`   ❌ Migration failed: ${error.message}`)
      return false
    }

    console.log(`   ✅ Migration completed successfully`)
    return true
  } catch (error: any) {
    console.error(`   ❌ Error reading/executing migration: ${error.message}`)
    return false
  }
}

async function main() {
  console.log('🚀 Starting database migrations...\n')
  console.log(`📍 Supabase URL: ${supabaseUrl}`)
  console.log(`📦 Total migrations to run: ${MIGRATIONS.length}\n`)

  let successCount = 0
  let failCount = 0

  for (const migration of MIGRATIONS) {
    const success = await runMigration(migration)
    if (success) {
      successCount++
    } else {
      failCount++
    }
  }

  console.log('\n' + '='.repeat(60))
  console.log('📊 Migration Results:')
  console.log(`   ✅ Successful: ${successCount}/${MIGRATIONS.length}`)
  console.log(`   ❌ Failed: ${failCount}/${MIGRATIONS.length}`)

  if (failCount === 0) {
    console.log('\n🎉 All migrations completed successfully!')
    console.log('\nNext steps:')
    console.log('1. Restart your Next.js application')
    console.log('2. Visit /dashboard to see the new features')
    console.log('3. Check /stuck-items for stuck work items')
    console.log('4. Review DLQ with: SELECT * FROM dead_letter_queue')
  } else {
    console.log('\n⚠️  Some migrations failed.')
    console.log('Please run migrations manually via Supabase Dashboard SQL Editor.')
    console.log(`\nCombined SQL file available at: /tmp/combined_migrations.sql`)
    process.exit(1)
  }
}

main()
