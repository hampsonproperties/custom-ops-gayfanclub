/**
 * Update Order #6540 to Deposit Paid Status
 *
 * The $1,000 invoice is fully paid, but it's only the 50% deposit.
 * Order should show as deposit paid, awaiting final payment.
 */

const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function updateToDepositPaid() {
  console.log('================================================================================');
  console.log('UPDATE ORDER #6540 TO DEPOSIT PAID STATUS');
  console.log('================================================================================\n');

  const { data: workItem, error } = await supabase
    .from('work_items')
    .select('id, shopify_order_number, customer_name, shopify_financial_status, status')
    .eq('shopify_order_number', '#6540')
    .single();

  if (error || !workItem) {
    console.error('Error finding work item:', error);
    return;
  }

  console.log('Current Status:');
  console.log(`  Customer: ${workItem.customer_name}`);
  console.log(`  Order: ${workItem.shopify_order_number}`);
  console.log(`  Shopify Financial Status: ${workItem.shopify_financial_status}`);
  console.log(`  Work Item Status: ${workItem.status}`);
  console.log();

  console.log('Context:');
  console.log('  - $1,000 invoice (50% deposit) is FULLY paid');
  console.log('  - Overall order is only 50% paid');
  console.log('  - Final $1,000 invoice (50% balance) still due');
  console.log();

  console.log('Updating status to reflect deposit paid...');
  console.log();

  // Update to deposit_paid_ready_for_batch
  const { error: updateError } = await supabase
    .from('work_items')
    .update({
      status: 'deposit_paid_ready_for_batch',
      // Keep shopify_financial_status as "paid" since that invoice IS paid
      updated_at: new Date().toISOString()
    })
    .eq('id', workItem.id);

  if (updateError) {
    console.error('✗ Failed to update:', updateError);
    return;
  }

  console.log('✓ Updated successfully!');

  // Create status event
  await supabase.from('work_item_status_events').insert({
    work_item_id: workItem.id,
    from_status: workItem.status,
    to_status: 'deposit_paid_ready_for_batch',
    changed_by_user_id: null,
    note: '50% deposit invoice ($1,000) paid - awaiting final payment invoice',
  });

  console.log('✓ Status event logged');
  console.log();

  console.log('================================================================================');
  console.log('UPDATED STATUS');
  console.log('================================================================================');
  console.log(`  shopify_financial_status: "paid" (deposit invoice is paid)`);
  console.log(`  status: "deposit_paid_ready_for_batch" (only 50% of order paid)`);
  console.log();
  console.log('Next steps:');
  console.log('  1. Order can be added to print batch (deposit is paid)');
  console.log('  2. Send final invoice for remaining $1,000 when ready');
  console.log('  3. Update to "paid_ready_for_batch" when final payment received');
}

updateToDepositPaid()
  .then(() => process.exit(0))
  .catch(err => {
    console.error('Failed:', err);
    process.exit(1);
  });
