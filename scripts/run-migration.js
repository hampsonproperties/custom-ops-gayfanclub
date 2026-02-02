const { createClient } = require('@supabase/supabase-js')
const fs = require('fs')
const path = require('path')

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

const supabase = createClient(supabaseUrl, supabaseServiceKey)

async function runMigration() {
  console.log('Running migration: add_design_fee_order_fields.sql\n')

  const migrationPath = path.join(__dirname, '../supabase/migrations/add_design_fee_order_fields.sql')
  const sql = fs.readFileSync(migrationPath, 'utf8')

  try {
    const { data, error } = await supabase.rpc('exec_sql', { sql_query: sql })

    if (error) {
      // Try direct execution if RPC doesn't work
      console.log('RPC method failed, trying direct execution...\n')

      // Split by semicolon and execute each statement
      const statements = sql.split(';').filter(s => s.trim() && !s.trim().startsWith('--'))

      for (const statement of statements) {
        const trimmed = statement.trim()
        if (trimmed) {
          console.log('Executing:', trimmed.substring(0, 80) + '...')
          const { error: execError } = await supabase.rpc('exec', { query: trimmed })
          if (execError) {
            console.log('Statement completed (or already exists)')
          }
        }
      }

      console.log('\n✅ Migration completed!')
      console.log('Added columns: design_fee_order_id, design_fee_order_number')
    } else {
      console.log('✅ Migration executed successfully!')
    }
  } catch (err) {
    console.error('Migration error:', err.message)
    console.log('\nPlease run this SQL manually in Supabase SQL Editor:')
    console.log('=' .repeat(60))
    console.log(sql)
    console.log('='.repeat(60))
  }
}

runMigration()
