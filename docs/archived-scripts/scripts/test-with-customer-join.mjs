import { createClient } from '@supabase/supabase-js'
import fs from 'fs'

// Read .env.local
const envFile = fs.readFileSync('.env.local', 'utf8')
const envVars = {}
envFile.split('\n').forEach(line => {
  const [key, ...valueParts] = line.split('=')
  if (key && valueParts.length) {
    envVars[key.trim()] = valueParts.join('=').trim()
  }
})

const supabaseUrl = envVars.NEXT_PUBLIC_SUPABASE_URL
const supabaseServiceKey = envVars.SUPABASE_SERVICE_ROLE_KEY

const supabase = createClient(supabaseUrl, supabaseServiceKey)

async function testSearch() {
  const searchInput = '#6549'
  const searchTerm = searchInput.toLowerCase()

  console.log('Testing with customer join (like the hook does):\n')

  let query = supabase
    .from('work_items')
    .select('*, customer:customers(*)')
    .order('created_at', { ascending: false })

  const queryString = `customer_name.ilike.%${searchTerm}%,` +
    `customer_email.ilike.%${searchTerm}%,` +
    `shopify_order_number.ilike.%${searchTerm}%,` +
    `design_fee_order_number.ilike.%${searchTerm}%,` +
    `shopify_order_id.ilike.%${searchTerm}%,` +
    `design_fee_order_id.ilike.%${searchTerm}%,` +
    `title.ilike.%${searchTerm}%`

  query = query.or(queryString)

  const { data, error } = await query

  if (error) {
    console.error('Error with customer join:', error)
  } else {
    console.log(`Success! Found ${data?.length || 0} results`)
    if (data && data.length > 0) {
      console.log('\nFirst result:', JSON.stringify(data[0], null, 2))
    }
  }
}

testSearch()
