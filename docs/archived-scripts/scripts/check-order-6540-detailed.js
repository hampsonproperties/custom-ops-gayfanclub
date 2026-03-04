/**
 * Detailed Check of Order #6540
 *
 * Check all payment-related data including Shopify data
 */

const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function checkDetailed() {
  console.log('================================================================================');
  console.log('DETAILED CHECK: ORDER #6540');
  console.log('================================================================================\n');

  // Get work item
  const { data: item, error } = await supabase
    .from('work_items')
    .select('*')
    .eq('shopify_order_number', '#6540')
    .single();

  if (error) {
    console.error('Error fetching work item:', error);
    return;
  }

  console.log('Work Item Full Data:');
  console.log('─'.repeat(80));
  console.log(JSON.stringify(item, null, 2));
  console.log();

  // Check if there's Shopify order data
  if (item.shopify_order_id) {
    console.log('\n================================================================================');
    console.log('CHECKING SHOPIFY ORDER DATA');
    console.log('================================================================================\n');

    const { data: shopifyOrders, error: shopifyError } = await supabase
      .from('shopify_orders')
      .select('*')
      .eq('id', item.shopify_order_id);

    if (!shopifyError && shopifyOrders && shopifyOrders.length > 0) {
      console.log('Shopify Order Data:');
      console.log('─'.repeat(80));
      console.log(JSON.stringify(shopifyOrders[0], null, 2));
    } else {
      console.log('No Shopify order data found or error:', shopifyError);
    }
  }

  // Check for any payment records
  console.log('\n================================================================================');
  console.log('CHECKING FOR PAYMENT RECORDS');
  console.log('================================================================================\n');

  const { data: payments, error: paymentsError } = await supabase
    .from('payments')
    .select('*')
    .eq('work_item_id', item.id);

  if (!paymentsError && payments && payments.length > 0) {
    console.log(`Found ${payments.length} payment record(s):`);
    payments.forEach((p, i) => {
      console.log(`\nPayment ${i + 1}:`);
      console.log(JSON.stringify(p, null, 2));
    });
  } else {
    console.log('No payment records found');
    if (paymentsError) console.log('Error:', paymentsError);
  }
}

checkDetailed()
  .then(() => process.exit(0))
  .catch(err => {
    console.error('Failed:', err);
    process.exit(1);
  });
