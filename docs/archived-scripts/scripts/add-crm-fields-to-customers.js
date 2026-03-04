require('dotenv').config({ path: '.env.local' })
const { createClient } = require('@supabase/supabase-js')

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing required environment variables')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseServiceKey)

async function addCRMFields() {
  console.log('Adding CRM fields to customers table...\n')

  try {
    // Check if columns already exist
    const { data: columns, error: checkError } = await supabase
      .rpc('exec_sql', {
        sql: `
          SELECT column_name
          FROM information_schema.columns
          WHERE table_name = 'customers'
          AND column_name IN ('assigned_to_user_id', 'organization_name', 'estimated_value', 'next_follow_up_at');
        `
      })

    if (checkError && !checkError.message.includes('does not exist')) {
      // Try direct query instead
      console.log('Checking existing columns...')
    }

    // Add columns using raw SQL
    console.log('Adding columns to customers table...')

    const alterTableSQL = `
      -- Add CRM fields to customers table
      ALTER TABLE customers
        ADD COLUMN IF NOT EXISTS assigned_to_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
        ADD COLUMN IF NOT EXISTS organization_name TEXT,
        ADD COLUMN IF NOT EXISTS estimated_value NUMERIC(10,2),
        ADD COLUMN IF NOT EXISTS next_follow_up_at TIMESTAMPTZ;

      -- Create indexes for performance
      CREATE INDEX IF NOT EXISTS idx_customers_assigned_to
        ON customers(assigned_to_user_id)
        WHERE assigned_to_user_id IS NOT NULL;

      CREATE INDEX IF NOT EXISTS idx_customers_next_follow_up
        ON customers(next_follow_up_at)
        WHERE next_follow_up_at IS NOT NULL;

      -- Add comment
      COMMENT ON COLUMN customers.assigned_to_user_id IS 'User responsible for this customer relationship';
      COMMENT ON COLUMN customers.organization_name IS 'Company or organization name';
      COMMENT ON COLUMN customers.estimated_value IS 'Estimated total value of customer relationship';
      COMMENT ON COLUMN customers.next_follow_up_at IS 'Scheduled date for next follow-up';
    `

    // Execute using direct database connection would be better, but we'll use the API
    // For now, let's create a simpler approach

    console.log('\n⚠️  DATABASE MIGRATION NEEDED ⚠️')
    console.log('\nPlease run the following SQL in your Supabase SQL Editor:\n')
    console.log('----------------------------------------')
    console.log(alterTableSQL)
    console.log('----------------------------------------\n')

    console.log('After running the SQL, the customers table will have:')
    console.log('  - assigned_to_user_id (UUID, references users)')
    console.log('  - organization_name (TEXT)')
    console.log('  - estimated_value (NUMERIC)')
    console.log('  - next_follow_up_at (TIMESTAMPTZ)')
    console.log('  - Indexes for performance')

    console.log('\n✅ Migration SQL generated successfully')
    console.log('📝 Copy the SQL above and run it in Supabase SQL Editor')

  } catch (error) {
    console.error('Error:', error.message)
    process.exit(1)
  }
}

addCRMFields()
