/**
 * Update Order #6540 to Awaiting Customer Files
 *
 * Deposit is paid but customer needs to provide artwork
 */

const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function updateStatus() {
  console.log('================================================================================');
  console.log('UPDATE ORDER #6540 - AWAITING CUSTOMER FILES');
  console.log('================================================================================\n');

  const { data: workItem, error } = await supabase
    .from('work_items')
    .select('id, customer_name, shopify_order_number, status')
    .eq('shopify_order_number', '#6540')
    .single();

  if (error || !workItem) {
    console.error('Error finding work item:', error);
    return;
  }

  console.log('Current Status:');
  console.log(`  Customer: ${workItem.customer_name}`);
  console.log(`  Order: ${workItem.shopify_order_number}`);
  console.log(`  Status: ${workItem.status}`);
  console.log();

  console.log('Situation:');
  console.log('  - Deposit ($1,000) has been paid ✓');
  console.log('  - Customer is providing their own artwork');
  console.log('  - Awaiting artwork from customer before can batch');
  console.log();

  console.log('Updating status to "awaiting_customer_files"...');
  console.log();

  // Update status
  const { error: updateError } = await supabase
    .from('work_items')
    .update({
      status: 'awaiting_customer_files',
      updated_at: new Date().toISOString()
    })
    .eq('id', workItem.id);

  if (updateError) {
    console.error('✗ Failed to update:', updateError);
    return;
  }

  console.log('✓ Status updated successfully');

  // Create status event
  await supabase.from('work_item_status_events').insert({
    work_item_id: workItem.id,
    from_status: workItem.status,
    to_status: 'awaiting_customer_files',
    changed_by_user_id: null,
    note: 'Deposit paid - awaiting customer-provided artwork',
  });

  console.log('✓ Status event logged');
  console.log();

  console.log('================================================================================');
  console.log('UPDATED');
  console.log('================================================================================');
  console.log('Status: awaiting_customer_files');
  console.log();
  console.log('This order will NOT appear in "Ready for Batch" until artwork is received');
  console.log('and status is updated to a ready-for-batch status.');
}

updateStatus()
  .then(() => process.exit(0))
  .catch(err => {
    console.error('Failed:', err);
    process.exit(1);
  });
