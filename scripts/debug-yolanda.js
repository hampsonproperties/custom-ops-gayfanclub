const { createClient } = require('@supabase/supabase-js')

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

const supabase = createClient(supabaseUrl, supabaseServiceKey)

async function findYolanda() {
  console.log('Searching for Yolanda Jones work items...\n')

  // Search by email
  const { data: workItems, error } = await supabase
    .from('work_items')
    .select('*')
    .eq('customer_email', 'staffandyolanda@gmail.com')
    .order('created_at', { ascending: false })

  if (error) {
    console.error('Error:', error)
    return
  }

  if (!workItems || workItems.length === 0) {
    console.log('❌ No work items found for staffandyolanda@gmail.com')
    return
  }

  console.log(`✅ Found ${workItems.length} work item(s):\n`)

  workItems.forEach((item, index) => {
    console.log(`--- Work Item ${index + 1} ---`)
    console.log(`ID: ${item.id}`)
    console.log(`Type: ${item.type}`)
    console.log(`Status: ${item.status}`)
    console.log(`Customer: ${item.customer_name}`)
    console.log(`Shopify Order: ${item.shopify_order_number || 'none'}`)
    console.log(`Shopify Order ID: ${item.shopify_order_id || 'none'}`)
    console.log(`Closed At: ${item.closed_at || 'NOT CLOSED'}`)
    console.log(`Created: ${item.created_at}`)
    console.log(`Quantity: ${item.quantity || 'none'}`)
    console.log()
  })
}

findYolanda()
