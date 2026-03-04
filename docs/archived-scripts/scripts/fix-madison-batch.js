/**
 * Fix Madison Villamaino Batch Assignment
 *
 * All 3 Madison Villamaino orders should be in the Early January batch
 * (3 soldiers - Images, shipping to 3 different addresses)
 */

const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function fixMadisonBatch() {
  console.log('================================================================================');
  console.log('FIX MADISON VILLAMAINO BATCH ASSIGNMENT');
  console.log('================================================================================\n');

  // Find the Early January batch
  const { data: batch, error: batchError } = await supabase
    .from('batches')
    .select('id, name')
    .eq('name', 'Print Batch - Early January 2026')
    .single();

  if (batchError || !batch) {
    console.error('Error finding batch:', batchError);
    return;
  }

  console.log(`Found batch: ${batch.name} (ID: ${batch.id})\n`);

  // Find all Madison Villamaino work items
  const { data: items, error: itemsError } = await supabase
    .from('work_items')
    .select('id, customer_name, shopify_order_number, status, batch_id')
    .ilike('customer_name', 'Madison Villamaino')
    .order('shopify_order_number', { ascending: true });

  if (itemsError) {
    console.error('Error fetching Madison orders:', itemsError);
    return;
  }

  console.log(`Found ${items.length} Madison Villamaino work items:\n`);

  const needsUpdate = [];

  for (const item of items) {
    console.log(`Order #${item.shopify_order_number}`);
    console.log(`  Current Status: ${item.status}`);
    console.log(`  Current Batch: ${item.batch_id || 'None'}`);

    if (item.batch_id !== batch.id) {
      console.log(`  ⚠️  NEEDS UPDATE: Should be in batch ${batch.id}\n`);
      needsUpdate.push(item);
    } else {
      console.log(`  ✓ Already in correct batch\n`);
    }
  }

  if (needsUpdate.length === 0) {
    console.log('All Madison orders are already in the correct batch!');
    return;
  }

  console.log('================================================================================');
  console.log(`Updating ${needsUpdate.length} orders...\n`);

  for (const item of needsUpdate) {
    const { error: updateError } = await supabase
      .from('work_items')
      .update({
        batch_id: batch.id,
        status: 'batched'
      })
      .eq('id', item.id);

    if (updateError) {
      console.error(`  ✗ Failed to update Order #${item.shopify_order_number}: ${updateError.message}`);
    } else {
      console.log(`  ✓ Updated Order #${item.shopify_order_number} to batch "${batch.name}"`);
    }
  }

  console.log('\n================================================================================');
  console.log('VERIFICATION');
  console.log('================================================================================\n');

  // Verify all Madison orders are now in the batch
  const { data: verifyItems, error: verifyError } = await supabase
    .from('work_items')
    .select('shopify_order_number, status, batch_id')
    .ilike('customer_name', 'Madison Villamaino')
    .order('shopify_order_number', { ascending: true });

  if (!verifyError && verifyItems) {
    console.log('All Madison Villamaino orders:');
    verifyItems.forEach(item => {
      const inBatch = item.batch_id === batch.id ? '✓' : '✗';
      console.log(`  ${inBatch} Order #${item.shopify_order_number} - Status: ${item.status} - In Batch: ${item.batch_id === batch.id ? 'Yes' : 'No'}`);
    });
  }

  console.log('\nDone!');
}

fixMadisonBatch()
  .then(() => process.exit(0))
  .catch(err => {
    console.error('Failed:', err);
    process.exit(1);
  });
