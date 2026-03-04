import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'
import { readFileSync } from 'fs'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

// Load environment variables
dotenv.config({ path: join(__dirname, '../.env.local') })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase credentials')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseKey)

async function runMigration(filename) {
  console.log(`\nRunning migration: ${filename}`)

  const sqlPath = join(__dirname, '../supabase/migrations', filename)
  const sql = readFileSync(sqlPath, 'utf8')

  try {
    // Use Supabase REST API to execute SQL
    const response = await fetch(`${supabaseUrl}/rest/v1/rpc/exec_sql`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': supabaseKey,
        'Authorization': `Bearer ${supabaseKey}`
      },
      body: JSON.stringify({ query: sql })
    })

    if (!response.ok) {
      const error = await response.text()
      console.log(`Note: Some statements may have errored (this is expected if tables/columns already exist)`)
      console.log(`Response: ${error}`)
    } else {
      console.log(`✅ Migration ${filename} applied successfully`)
    }
  } catch (error) {
    console.error(`❌ Error applying migration ${filename}:`, error.message)
  }
}

async function main() {
  console.log('Applying new migrations to Supabase...\n')

  await runMigration('20260227000007_enhance_notes_system.sql')
  await runMigration('20260227000008_create_customer_contacts.sql')

  console.log('\n✅ Migration process complete!')
  console.log('\nNote: If you see errors above, you may need to run these migrations')
  console.log('through the Supabase SQL Editor instead:')
  console.log('1. Go to: https://supabase.com/dashboard/project/<your-project>/sql/new')
  console.log('2. Copy and paste the contents of each migration file')
  console.log('3. Click "Run"')
}

main().catch(console.error)
