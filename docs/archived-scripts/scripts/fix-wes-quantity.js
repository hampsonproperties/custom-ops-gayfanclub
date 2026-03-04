// Run with: export $(grep -v '^#' .env.local | xargs) && node scripts/fix-wes-quantity.js
const { createClient } = require('@supabase/supabase-js')

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing environment variables')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseServiceKey)

async function fixWesQuantity() {
  console.log('Updating Wes Wagman\'s work item quantity to 200...\n')

  try {
    // Find Wes's work item
    const { data: workItems, error: findError } = await supabase
      .from('work_items')
      .select('*')
      .eq('customer_email', 'wesrankin@gmail.com')
      .order('created_at', { ascending: false })
      .limit(1)

    if (findError) {
      console.error('Error finding work item:', findError)
      return
    }

    if (!workItems || workItems.length === 0) {
      console.log('No work items found for Wes')
      return
    }

    const workItem = workItems[0]
    console.log('Found work item:', {
      id: workItem.id,
      customer_name: workItem.customer_name,
      customer_email: workItem.customer_email,
      shopify_order_number: workItem.shopify_order_number,
      current_quantity: workItem.quantity,
    })

    // Update quantity to 200
    console.log('\nUpdating quantity to 200...')
    const { error: updateError } = await supabase
      .from('work_items')
      .update({
        quantity: 200,
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
    console.log('New quantity:', updated.quantity)
  } catch (err) {
    console.error('Error:', err.message)
  }
}

fixWesQuantity()
