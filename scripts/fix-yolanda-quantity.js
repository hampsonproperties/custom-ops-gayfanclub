const { createClient } = require('@supabase/supabase-js')

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

const supabase = createClient(supabaseUrl, supabaseServiceKey)

async function fixQuantity() {
  console.log('Updating Yolanda work item quantity to 230...\n')

  const { data, error } = await supabase
    .from('work_items')
    .update({ quantity: 230 })
    .eq('id', '768f8e4a-9bb6-4edb-9125-7a7ca68ba3dd')
    .select()
    .single()

  if (error) {
    console.error('❌ Error:', error)
    return
  }

  console.log('✅ Successfully updated quantity to 230')
  console.log('Work item:', data.customer_name, '-', data.shopify_order_number)
  console.log('Quantity:', data.quantity)
}

fixQuantity()
