#!/usr/bin/env node

const { createClient } = require('@supabase/supabase-js')
const fs = require('fs')
const path = require('path')

// Load environment variables
require('dotenv').config({ path: '.env.local' })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing Supabase credentials')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseServiceKey)

// Migration files to run (in order)
const migrations = [
  '20260227000001_retail_accounts.sql',
  '20260227000002_add_email_ownership.sql',
  '20260227000003_add_proof_tracking.sql',
  '20260227000004_add_batch_drip_emails.sql',
  '20260227000005_insert_batch_drip_email_templates.sql',
]

async function runMigration(filename) {
  const filepath = path.join(__dirname, 'supabase', 'migrations', filename)
  const sql = fs.readFileSync(filepath, 'utf8')

  console.log(`\n📝 Running migration: ${filename}`)
  console.log(`   File: ${filepath}`)
  console.log(`   Size: ${sql.length} bytes`)

  try {
    // Execute the SQL
    const { data, error } = await supabase.rpc('exec_sql', { sql_query: sql })

    if (error) {
      // Try direct query if rpc doesn't work
      const { error: queryError } = await supabase.from('_').select('*').limit(0)

      // Since we can't execute raw SQL via the JS client easily,
      // let's use the PostgREST API directly
      const response = await fetch(`${supabaseUrl}/rest/v1/rpc/exec_sql`, {
        method: 'POST',
        headers: {
          'apikey': supabaseServiceKey,
          'Authorization': `Bearer ${supabaseServiceKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ sql_query: sql })
      })

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${await response.text()}`)
      }

      console.log(`   ✅ Migration applied successfully`)
      return true
    }

    console.log(`   ✅ Migration applied successfully`)
    return true
  } catch (err) {
    console.error(`   ❌ Migration failed:`, err.message)
    return false
  }
}

async function main() {
  console.log('🚀 Starting migration process...')
  console.log(`   Supabase URL: ${supabaseUrl}`)
  console.log(`   Migrations to run: ${migrations.length}`)

  let successCount = 0
  let failCount = 0

  for (const migration of migrations) {
    const success = await runMigration(migration)
    if (success) {
      successCount++
    } else {
      failCount++
      console.log(`\n⚠️  Migration ${migration} failed. Continuing with next migration...\n`)
    }
  }

  console.log('\n' + '='.repeat(60))
  console.log('📊 Migration Summary:')
  console.log(`   ✅ Successful: ${successCount}`)
  console.log(`   ❌ Failed: ${failCount}`)
  console.log(`   📝 Total: ${migrations.length}`)
  console.log('='.repeat(60))

  if (failCount > 0) {
    console.log('\n⚠️  Some migrations failed. Please review the errors above.')
    console.log('   You may need to run them manually in the Supabase SQL editor.')
    process.exit(1)
  } else {
    console.log('\n✅ All migrations completed successfully!')
  }
}

main().catch(err => {
  console.error('\n❌ Fatal error:', err)
  process.exit(1)
})
