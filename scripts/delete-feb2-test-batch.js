/**
 * Delete "Feb 2" Test Batch
 *
 * Removes the test batch and un-batches its work items
 */

const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function deleteTestBatch() {
  console.log('================================================================================');
  console.log('DELETE "FEB 2" TEST BATCH');
  console.log('================================================================================\n');

  // Find the Feb 2 batch
  const { data: batches, error: searchError } = await supabase
    .from('batches')
    .select('*')
    .ilike('name', '%Feb 2%');

  if (searchError) {
    console.error('Error searching for batch:', searchError);
    return;
  }

  if (!batches || batches.length === 0) {
    console.log('No batches found matching "Feb 2"');
    console.log('\nSearching for test batches...');

    const { data: allBatches } = await supabase
      .from('batches')
      .select('id, name, status, created_at')
      .order('created_at', { ascending: false })
      .limit(10);

    if (allBatches && allBatches.length > 0) {
      console.log('\nRecent batches:');
      allBatches.forEach((b, i) => {
        console.log(`  ${i + 1}. "${b.name}" - ${b.status} - Created: ${b.created_at}`);
      });
    }
    return;
  }

  console.log(`Found ${batches.length} batch(es) matching "Feb 2":\n`);
  batches.forEach((b, i) => {
    console.log(`  ${i + 1}. "${b.name}"`);
    console.log(`     ID: ${b.id}`);
    console.log(`     Status: ${b.status}`);
    console.log(`     Created: ${b.created_at}`);
    console.log();
  });

  // Delete each batch
  for (const batch of batches) {
    console.log(`Deleting batch: "${batch.name}"`);

    // First, get all work items in this batch
    const { data: batchItems } = await supabase
      .from('batch_items')
      .select('work_item_id')
      .eq('batch_id', batch.id);

    if (batchItems && batchItems.length > 0) {
      const workItemIds = batchItems.map(item => item.work_item_id);
      console.log(`  Found ${workItemIds.length} work items to un-batch`);

      // Un-batch the work items
      const { error: updateError } = await supabase
        .from('work_items')
        .update({
          batch_id: null,
          batched_at: null,
          status: 'paid_ready_for_batch' // or whatever status is appropriate
        })
        .in('id', workItemIds);

      if (updateError) {
        console.error(`  ✗ Failed to un-batch work items:`, updateError);
        continue;
      }

      console.log(`  ✓ Un-batched ${workItemIds.length} work items`);
    }

    // Delete batch items
    const { error: itemsError } = await supabase
      .from('batch_items')
      .delete()
      .eq('batch_id', batch.id);

    if (itemsError) {
      console.error(`  ✗ Failed to delete batch items:`, itemsError);
      continue;
    }

    console.log(`  ✓ Deleted batch items`);

    // Delete the batch itself
    const { error: batchError } = await supabase
      .from('batches')
      .delete()
      .eq('id', batch.id);

    if (batchError) {
      console.error(`  ✗ Failed to delete batch:`, batchError);
      continue;
    }

    console.log(`  ✓ Deleted batch "${batch.name}"`);
    console.log();
  }

  console.log('================================================================================');
  console.log('DONE!');
  console.log('================================================================================');
}

deleteTestBatch()
  .then(() => process.exit(0))
  .catch(err => {
    console.error('Failed:', err);
    process.exit(1);
  });
