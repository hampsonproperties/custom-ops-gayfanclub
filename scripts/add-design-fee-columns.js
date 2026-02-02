const { createClient } = require('@supabase/supabase-js')

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

const supabase = createClient(supabaseUrl, supabaseServiceKey)

async function addColumns() {
  console.log('Adding design_fee_order_id and design_fee_order_number columns...\n')

  try {
    // Test if columns exist by trying to select them
    const { error: testError } = await supabase
      .from('work_items')
      .select('design_fee_order_id, design_fee_order_number')
      .limit(1)

    if (!testError) {
      console.log('✅ Columns already exist!')
      return
    }

    console.log('Columns do not exist. Please run this SQL in Supabase SQL Editor:')
    console.log('=' .repeat(70))
    console.log(`
ALTER TABLE work_items
ADD COLUMN IF NOT EXISTS design_fee_order_id TEXT,
ADD COLUMN IF NOT EXISTS design_fee_order_number TEXT;
    `)
    console.log('='.repeat(70))
    console.log('\n1. Go to: https://supabase.com/dashboard/project/uvdaqjxmstbhfcgjlemm/sql/new')
    console.log('2. Paste the SQL above')
    console.log('3. Click "Run"')
    console.log('4. Run this script again to verify')
  } catch (err) {
    console.error('Error:', err.message)
  }
}

addColumns()
