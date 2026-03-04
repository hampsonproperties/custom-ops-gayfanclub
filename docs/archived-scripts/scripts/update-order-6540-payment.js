/**
 * Update Order #6540 to Partial Payment Status
 *
 * Updates the order to reflect that partial payment has been received
 */

const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function updatePaymentStatus() {
  console.log('================================================================================');
  console.log('UPDATE ORDER #6540 TO PARTIAL PAYMENT');
  console.log('================================================================================\n');

  const workItemId = 'eb47dd34-e83a-4ac0-86d5-c4486494f424';

  // Get current state
  const { data: before, error: fetchError } = await supabase
    .from('work_items')
    .select('shopify_order_number, customer_name, shopify_financial_status, status')
    .eq('id', workItemId)
    .single();

  if (fetchError) {
    console.error('Error fetching work item:', fetchError);
    return;
  }

  console.log('Current Status:');
  console.log(`  Customer: ${before.customer_name}`);
  console.log(`  Order: ${before.shopify_order_number}`);
  console.log(`  Status: ${before.status}`);
  console.log(`  Shopify Financial Status: ${before.shopify_financial_status}`);
  console.log();

  console.log('Updating to:');
  console.log(`  Shopify Financial Status: partially_paid`);
  console.log(`  Status: invoice_sent (keep same)`);
  console.log();

  // Update to partially paid
  const { error: updateError } = await supabase
    .from('work_items')
    .update({
      shopify_financial_status: 'partially_paid'
    })
    .eq('id', workItemId);

  if (updateError) {
    console.error('✗ Failed to update:', updateError.message);
    return;
  }

  console.log('✓ Updated successfully!');

  // Verify
  const { data: after, error: verifyError } = await supabase
    .from('work_items')
    .select('shopify_order_number, customer_name, shopify_financial_status, status')
    .eq('id', workItemId)
    .single();

  if (!verifyError) {
    console.log('\nVerified New Status:');
    console.log(`  Customer: ${after.customer_name}`);
    console.log(`  Order: ${after.shopify_order_number}`);
    console.log(`  Status: ${after.status}`);
    console.log(`  Shopify Financial Status: ${after.shopify_financial_status}`);
  }

  console.log('\nDone! Order #6540 now shows as partially paid.');
}

updatePaymentStatus()
  .then(() => process.exit(0))
  .catch(err => {
    console.error('Failed:', err);
    process.exit(1);
  });
