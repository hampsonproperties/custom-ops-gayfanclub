import { createClient } from '@supabase/supabase-js'
import * as fs from 'fs'
import * as path from 'path'

// Read environment variables
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing Supabase credentials')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseServiceKey)

async function runMigration(migrationFile: string) {
  console.log(`Running migration: ${migrationFile}`)

  const sqlPath = path.join(process.cwd(), 'supabase', 'migrations', migrationFile)
  const sql = fs.readFileSync(sqlPath, 'utf8')

  try {
    // Split SQL by semicolons and execute each statement
    const statements = sql
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0 && !s.startsWith('--'))

    for (const statement of statements) {
      if (statement) {
        const { error } = await supabase.rpc('exec_sql', { sql_query: statement })
        if (error && !error.message.includes('already exists')) {
          console.error(`Error executing statement:`, error)
          throw error
        }
      }
    }

    console.log(`✓ Migration ${migrationFile} completed successfully`)
  } catch (error) {
    console.error(`✗ Migration ${migrationFile} failed:`, error)
    throw error
  }
}

async function main() {
  try {
    // Run the two new migrations
    await runMigration('20260227000007_enhance_notes_system.sql')
    await runMigration('20260227000008_create_customer_contacts.sql')

    console.log('\n✓ All migrations completed successfully!')
  } catch (error) {
    console.error('\n✗ Migration failed:', error)
    process.exit(1)
  }
}

main()
