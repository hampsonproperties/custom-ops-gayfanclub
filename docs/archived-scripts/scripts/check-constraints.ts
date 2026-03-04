/**
 * Check database constraints on communications table
 */

import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'
import { resolve } from 'path'

config({ path: resolve(process.cwd(), '.env.local') })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

async function checkConstraints() {
  const supabase = createClient(supabaseUrl, supabaseServiceKey)

  console.log(`\n🔍 Checking constraints on communications table...\n`)

  // Check unique constraint
  const { data: constraints, error } = await supabase.rpc('exec_sql', {
    query: `
      SELECT
        conname AS constraint_name,
        contype AS constraint_type,
        a.attname AS column_name
      FROM pg_constraint c
      JOIN pg_attribute a ON a.attnum = ANY(c.conkey)
      WHERE c.conrelid = 'communications'::regclass
      AND a.attrelid = 'communications'::regclass
      ORDER BY conname;
    `
  })

  if (error) {
    // Try direct query
    const { data: pgData } = await supabase.from('information_schema.table_constraints').select('*')
    console.log('Using information_schema:', pgData)
  } else {
    console.log('Constraints:', constraints)
  }

  // Alternative: Check indexes
  const { data: indexes } = await supabase.rpc('exec_sql', {
    query: `
      SELECT
        indexname,
        indexdef
      FROM pg_indexes
      WHERE tablename = 'communications';
    `
  })

  if (!error && indexes) {
    console.log('\nIndexes on communications:')
    for (const idx of indexes || []) {
      console.log(`  - ${idx.indexname}`)
      console.log(`    ${idx.indexdef}`)
    }
  }

  // Simpler approach - just query the table
  console.log('\n📊 Testing duplicate insert...')

  const testMessageId = 'test-duplicate-' + Date.now()

  try {
    // First insert
    const { error: insert1Error } = await supabase.from('communications').insert({
      direction: 'inbound',
      from_email: 'test@test.com',
      internet_message_id: testMessageId,
      received_at: new Date().toISOString(),
      subject: 'Test',
    })

    if (insert1Error) {
      console.log('❌ First insert failed:', insert1Error.message)
      return
    }

    console.log('✅ First insert successful')

    // Try duplicate
    const { error: insert2Error } = await supabase.from('communications').insert({
      direction: 'inbound',
      from_email: 'test@test.com',
      internet_message_id: testMessageId, // SAME message ID
      received_at: new Date().toISOString(),
      subject: 'Test Duplicate',
    })

    if (insert2Error) {
      console.log('✅ GOOD: Duplicate prevented!')
      console.log(`   Error: ${insert2Error.message}`)
    } else {
      console.log('❌ BAD: Duplicate was allowed! Unique constraint is NOT working!')
    }

    // Cleanup
    await supabase.from('communications').delete().eq('internet_message_id', testMessageId)

  } catch (err) {
    console.log('Error during test:', err)
  }
}

checkConstraints().catch(console.error)
