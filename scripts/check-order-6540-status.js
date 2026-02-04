/**
 * Check and Fix Order #6540 Payment Status
 *
 * Order shows "invoice sent" but has been partially paid
 */

const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function checkOrder6540() {
  console.log('================================================================================');
  console.log('CHECK ORDER #6540 PAYMENT STATUS');
  console.log('================================================================================\n');

  // Find the work item
  const { data: item, error } = await supabase
    .from('work_items')
    .select('*')
    .eq('id', 'eb47dd34-e83a-4ac0-86d5-c4486494f424')
    .single();

  if (error) {
    console.error('Error fetching work item:', error);
    return;
  }

  console.log('Current Work Item Details:');
  console.log('─'.repeat(80));
  console.log(`Customer: ${item.customer_name}`);
  console.log(`Order #: ${item.shopify_order_number}`);
  console.log(`Status: ${item.status}`);
  console.log(`Payment Status: ${item.payment_status}`);
  console.log(`Quantity: ${item.quantity}`);
  console.log(`Total Price: $${item.total_price || 'N/A'}`);
  console.log(`Amount Paid: $${item.amount_paid || '0'}`);
  console.log(`Design Fee: $${item.design_fee || '0'}`);
  console.log(`Design Fee Paid: ${item.design_fee_paid ? 'Yes' : 'No'}`);
  console.log();

  // Determine correct payment status
  let correctPaymentStatus = item.payment_status;
  let needsUpdate = false;

  if (item.amount_paid && item.amount_paid > 0) {
    if (item.total_price && item.amount_paid >= item.total_price) {
      correctPaymentStatus = 'paid';
      if (item.payment_status !== 'paid') {
        needsUpdate = true;
        console.log('⚠️  Issue: Fully paid but status is not "paid"');
      }
    } else {
      correctPaymentStatus = 'partially_paid';
      if (item.payment_status !== 'partially_paid') {
        needsUpdate = true;
        console.log('⚠️  Issue: Partially paid but status is not "partially_paid"');
      }
    }
  } else if (item.payment_status !== 'pending' && item.payment_status !== 'invoice_sent') {
    console.log('⚠️  Issue: No payment received but status is not pending/invoice_sent');
  }

  if (!needsUpdate) {
    console.log('✓ Payment status appears correct');
    return;
  }

  console.log('\n================================================================================');
  console.log('UPDATING PAYMENT STATUS');
  console.log('================================================================================\n');

  console.log(`Updating from "${item.payment_status}" to "${correctPaymentStatus}"`);

  const { error: updateError } = await supabase
    .from('work_items')
    .update({
      payment_status: correctPaymentStatus
    })
    .eq('id', item.id);

  if (updateError) {
    console.error('✗ Failed to update:', updateError.message);
  } else {
    console.log('✓ Payment status updated successfully');
  }

  // Verify
  const { data: updated, error: verifyError } = await supabase
    .from('work_items')
    .select('payment_status, amount_paid, total_price')
    .eq('id', item.id)
    .single();

  if (!verifyError) {
    console.log('\nVerified:');
    console.log(`  Payment Status: ${updated.payment_status}`);
    console.log(`  Amount Paid: $${updated.amount_paid || '0'}`);
    console.log(`  Total Price: $${updated.total_price || 'N/A'}`);
  }

  console.log('\nDone!');
}

checkOrder6540()
  .then(() => process.exit(0))
  .catch(err => {
    console.error('Failed:', err);
    process.exit(1);
  });
