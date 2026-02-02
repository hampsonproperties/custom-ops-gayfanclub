// Run with: export $(grep -v '^#' .env.local | xargs) && node scripts/update-yolanda-design-fee.js
const { createClient } = require('@supabase/supabase-js')

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing environment variables. Run this script with:')
  console.error('export $(grep -v \'^#\' .env.local | xargs) && node scripts/update-yolanda-design-fee.js')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseServiceKey)

async function updateYolanda() {
  console.log('Finding work item with order #6541...\n')

  try {
    // Find by production order number #6541
    const { data: workItems, error: findError } = await supabase
      .from('work_items')
      .select('*')
      .eq('shopify_order_number', '#6541')
      .limit(1)

    if (findError) {
      console.error('Error finding work item:', findError)
      return
    }

    if (!workItems || workItems.length === 0) {
      console.log('No work items found for Yolanda')
      return
    }

    const workItem = workItems[0]
    console.log('Found work item:', {
      id: workItem.id,
      customer_name: workItem.customer_name,
      customer_email: workItem.customer_email,
      status: workItem.status,
      shopify_order_number: workItem.shopify_order_number,
      design_fee_order_number: workItem.design_fee_order_number,
      quantity: workItem.quantity,
    })

    // Update with design fee order info
    console.log('\nUpdating with design fee order #6521...')
    const { error: updateError } = await supabase
      .from('work_items')
      .update({
        design_fee_order_id: '6165908300092',  // Shopify internal ID for order #6521
        design_fee_order_number: '#6521',
      })
      .eq('id', workItem.id)

    if (updateError) {
      console.error('Error updating work item:', updateError)
      return
    }

    // Fetch updated work item
    const { data: updated } = await supabase
      .from('work_items')
      .select('*')
      .eq('id', workItem.id)
      .single()

    console.log('\n✅ Work item updated successfully!')
    console.log('Updated fields:', {
      design_fee_order_id: updated.design_fee_order_id,
      design_fee_order_number: updated.design_fee_order_number,
      shopify_order_id: updated.shopify_order_id,
      shopify_order_number: updated.shopify_order_number,
    })
  } catch (err) {
    console.error('Error:', err.message)
  }
}

updateYolanda()
