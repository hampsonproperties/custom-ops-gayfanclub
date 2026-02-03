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

async function checkOrder() {
  // Search for order 6549 in all possible fields
  const { data: allOrders, error } = await supabase
    .from('work_items')
    .select('id, shopify_order_number, design_fee_order_number, shopify_order_id, design_fee_order_id, customer_name, customer_email')
    .or('shopify_order_number.ilike.%6549%,design_fee_order_number.ilike.%6549%,shopify_order_id.ilike.%6549%,design_fee_order_id.ilike.%6549%')

  console.log('Search results for "6549":')
  console.log(JSON.stringify(allOrders, null, 2))
  console.log(`\nTotal results: ${allOrders?.length || 0}`)

  if (error) {
    console.error('Error:', error)
  }

  // Also try exact match on order number
  const { data: exactMatch } = await supabase
    .from('work_items')
    .select('*')
    .eq('shopify_order_number', '#6549')
    .maybeSingle()

  console.log('\n\nExact match for shopify_order_number = "#6549":')
  console.log(JSON.stringify(exactMatch, null, 2))
}

checkOrder()
