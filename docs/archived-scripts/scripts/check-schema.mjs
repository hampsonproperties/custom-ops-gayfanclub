import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

// Load environment variables
dotenv.config({ path: join(__dirname, '../.env.local') })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing Supabase credentials')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseServiceKey)

async function checkSchema() {
  console.log('Checking if migrations are needed...\n')

  // Check if customer_contacts table exists
  const { data: customerContactsExists, error: error1 } = await supabase
    .from('customer_contacts')
    .select('id')
    .limit(1)

  if (error1) {
    console.log('❌ customer_contacts table does NOT exist')
    console.log('   Need to run migration: 20260227000008_create_customer_contacts.sql')
  } else {
    console.log('✅ customer_contacts table exists')
  }

  // Check if work_item_notes has starred column
  const { data: notesData, error: error2 } = await supabase
    .from('work_item_notes')
    .select('starred')
    .limit(1)

  if (error2) {
    console.log('❌ work_item_notes.starred column does NOT exist')
    console.log('   Need to run migration: 20260227000007_enhance_notes_system.sql')
  } else {
    console.log('✅ work_item_notes.starred column exists')
  }

  console.log('\nSchema check complete!')
}

checkSchema().catch(console.error)
