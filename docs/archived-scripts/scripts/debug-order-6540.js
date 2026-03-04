// Run with: export $(grep -v '^#' .env.local | xargs) && node scripts/debug-order-6540.js
const { createClient } = require('@supabase/supabase-js')

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing environment variables')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseServiceKey)

async function debugOrder() {
  console.log('Searching for order #6540...\n')

  try {
    // Search by order number
    const { data: workItems, error } = await supabase
      .from('work_items')
      .select('*')
      .or('shopify_order_number.eq.#6540,design_fee_order_number.eq.#6540')
      .order('created_at', { ascending: false })

    if (error) {
      console.error('Error:', error)
      return
    }

    if (!workItems || workItems.length === 0) {
      console.log('❌ No work items found for order #6540')
      console.log('\nThis could mean:')
      console.log('1. The import failed')
      console.log('2. The order is not a custom order (check order type detection)')
      console.log('3. The order number format is different')
      return
    }

    console.log(`✅ Found ${workItems.length} work item(s) for order #6540:\n`)

    workItems.forEach((item, index) => {
      console.log(`--- Work Item ${index + 1} ---`)
      console.log('ID:', item.id)
      console.log('Type:', item.type)
      console.log('Status:', item.status)
      console.log('Customer:', item.customer_name || item.customer_email)
      console.log('Shopify Order:', item.shopify_order_number)
      console.log('Design Fee Order:', item.design_fee_order_number)
      console.log('Quantity:', item.quantity)
      console.log('Grip Color:', item.grip_color)
      console.log('Created:', item.created_at)
      console.log('Closed:', item.closed_at)
      console.log('')
    })

    // Show where it should appear based on status
    const item = workItems[0]
    console.log('📍 Where this should appear:')
    console.log('----------------------------')

    if (item.type === 'customify_order') {
      if (item.status === 'needs_design_review' || item.status === 'needs_customer_fix') {
        console.log('✓ Design Review Queue (/design-queue)')
      }
      if (item.status === 'approved') {
        console.log('✓ Approved Designs (/approved-designs) - Approved section')
      }
      if (item.status === 'ready_for_batch') {
        console.log('✓ Approved Designs (/approved-designs) - Ready for Batch section')
        console.log('✓ Batches page (/batches) - Ready for Batch queue')
      }
    } else if (item.type === 'assisted_project') {
      console.log('✓ Custom Design Queue (/custom-design-queue)')
      if (item.status === 'paid_ready_for_batch') {
        console.log('✓ Batches page (/batches) - Ready for Batch queue')
      }
    }

    console.log('✓ All Work Items page (/work-items)')

  } catch (err) {
    console.error('Error:', err.message)
  }
}

debugOrder()
