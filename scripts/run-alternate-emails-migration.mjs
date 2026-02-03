import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = 'https://uvdaqjxmstbhfcgjlemm.supabase.co'
const SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InV2ZGFxanhtc3RiaGZjZ2psZW1tIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2OTU1NjYxMiwiZXhwIjoyMDg1MTMyNjEyfQ.aD3n7cnEBfMO4E8iZqEXly8QUlggUu-LNHjxcve19Ds'

const supabase = createClient(SUPABASE_URL, SERVICE_KEY)

async function runMigration() {
  console.log('🔄 Running migration: add alternate_emails column...\n')

  try {
    // Add the column
    const { error: alterError } = await supabase.rpc('exec_sql', {
      sql: `
        ALTER TABLE work_items
        ADD COLUMN IF NOT EXISTS alternate_emails TEXT[] DEFAULT '{}';
      `
    })

    if (alterError && !alterError.message.includes('already exists')) {
      console.error('❌ Error adding column:', alterError)
      return
    }

    console.log('✅ Column added: alternate_emails')

    // Add the index
    const { error: indexError } = await supabase.rpc('exec_sql', {
      sql: `
        CREATE INDEX IF NOT EXISTS idx_work_items_alternate_emails
        ON work_items USING GIN (alternate_emails);
      `
    })

    if (indexError && !indexError.message.includes('already exists')) {
      console.error('❌ Error creating index:', indexError)
      return
    }

    console.log('✅ Index created: idx_work_items_alternate_emails')

    // Add comment
    const { error: commentError } = await supabase.rpc('exec_sql', {
      sql: `
        COMMENT ON COLUMN work_items.alternate_emails IS
        'Additional email addresses associated with this customer (e.g., personal vs work email). Used for auto-linking emails from the same customer.';
      `
    })

    if (commentError) {
      console.log('⚠️  Could not add column comment (this is optional)')
    } else {
      console.log('✅ Column comment added')
    }

    console.log('\n🎉 Migration completed successfully!')

    // Test by adding delibellules.basil@gmail.com as alternate for work item #6549
    console.log('\n📝 Adding delibellules.basil@gmail.com as alternate email for work item #6549...')

    const { error: updateError } = await supabase
      .from('work_items')
      .update({
        alternate_emails: ['delibellules.basil@gmail.com']
      })
      .eq('id', 'c0ae0c91-73c4-4d5c-9ef2-52cb86bede5e')

    if (updateError) {
      console.error('❌ Error adding alternate email:', updateError)
    } else {
      console.log('✅ Alternate email added successfully!')
    }

  } catch (error) {
    console.error('💥 Migration failed:', error)
  }
}

runMigration()
  .then(() => process.exit(0))
  .catch(err => {
    console.error('Fatal error:', err)
    process.exit(1)
  })
