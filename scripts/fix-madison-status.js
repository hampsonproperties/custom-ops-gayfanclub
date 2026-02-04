/**
 * Fix Madison Villamaino Order Status
 *
 * Updates Madison's orders that are in batches but have wrong status
 */

const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function fixMadisonStatus() {
  console.log('================================================================================');
  console.log('FIX MADISON VILLAMAINO ORDER STATUS');
  console.log('================================================================================\n');

  // Find all Madison Villamaino work items that are in batches but have wrong status
  const { data: items, error } = await supabase
    .from('work_items')
    .select(`
      id,
      customer_name,
      shopify_order_number,
      status,
      batch_id,
      batches (
        id,
        name
      )
    `)
    .ilike('customer_name', 'Madison Villamaino');

  if (error) {
    console.error('Error fetching Madison orders:', error);
    return;
  }

  console.log(`Found ${items.length} Madison Villamaino work items:\n`);

  const needsUpdate = [];

  for (const item of items) {
    console.log(`Order #${item.shopify_order_number}`);
    console.log(`  Status: ${item.status}`);
    console.log(`  Batch: ${item.batch_id ? item.batches?.name : 'None'}`);

    if (item.batch_id && item.status !== 'batched') {
      console.log(`  ⚠️  NEEDS UPDATE: In batch but status is "${item.status}"\n`);
      needsUpdate.push(item);
    } else {
      console.log(`  ✓ Correct\n`);
    }
  }

  if (needsUpdate.length === 0) {
    console.log('All Madison orders have correct status!');
    return;
  }

  console.log('================================================================================');
  console.log(`Updating ${needsUpdate.length} orders to "batched" status...\n`);

  for (const item of needsUpdate) {
    const { error: updateError } = await supabase
      .from('work_items')
      .update({ status: 'batched' })
      .eq('id', item.id);

    if (updateError) {
      console.error(`  ✗ Failed to update Order #${item.shopify_order_number}: ${updateError.message}`);
    } else {
      console.log(`  ✓ Updated Order #${item.shopify_order_number} to "batched"`);
    }
  }

  console.log('\nDone!');
}

fixMadisonStatus()
  .then(() => process.exit(0))
  .catch(err => {
    console.error('Failed:', err);
    process.exit(1);
  });
