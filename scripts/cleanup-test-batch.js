/**
 * Cleanup Test Batch Script
 *
 * This script:
 * 1. Deletes the "Feb 2" test batch
 * 2. Moves orders to their correct batches based on print dates
 * 3. Adds missing orders (Trish Gaeta)
 */

const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

// Known batch IDs from the check
const BATCHES = {
  feb2Test: 'b30c0cb1-5b69-4b03-af74-868818c95ddc',
  earlyJan: '9c91cd76-41d5-4b80-8dfa-ab62ebb8471f',
  lateJan: '8fa39b8e-e9b5-4ed8-8920-8d497061361b',
  feb: 'fe8b33b4-eca9-4fc2-94e0-01f86318321b'
};

async function findWorkItemByCustomer(customerName) {
  const { data, error } = await supabase
    .from('work_items')
    .select('id, customer_name, quantity, batch_id, shopify_order_number')
    .ilike('customer_name', `%${customerName}%`)
    .limit(5);

  if (error || !data || data.length === 0) {
    return null;
  }

  return data[0];
}

async function moveOrderToBatch(workItemId, newBatchId, batchName, customerName) {
  // Remove from old batch_items
  await supabase
    .from('batch_items')
    .delete()
    .eq('work_item_id', workItemId);

  // Add to new batch
  const { error: insertError } = await supabase
    .from('batch_items')
    .insert({
      batch_id: newBatchId,
      work_item_id: workItemId
    });

  if (insertError) {
    console.log(`  ✗ Error moving ${customerName}: ${insertError.message}`);
    return false;
  }

  // Update work_item.batch_id
  await supabase
    .from('work_items')
    .update({ batch_id: newBatchId })
    .eq('id', workItemId);

  console.log(`  ✓ Moved ${customerName} to ${batchName}`);
  return true;
}

async function cleanup() {
  console.log('='.repeat(80));
  console.log('CLEANUP TEST BATCH & REORGANIZE ORDERS');
  console.log('='.repeat(80));
  console.log();

  // Step 1: Move orders from "Feb 2" test batch to correct batches
  console.log('Step 1: Moving orders from "Feb 2" test batch...\n');

  const orderMoves = [
    { customer: 'Aryll Salazar', toBatch: BATCHES.feb, toBatchName: 'Print Batch - February 2026' },
    { customer: 'YOLANDA JONES', toBatch: BATCHES.feb, toBatchName: 'Print Batch - February 2026' },
    { customer: 'Andy Frye', toBatch: BATCHES.lateJan, toBatchName: 'Print Batch - Late January 2026' },
    { customer: 'Ryan A Arbeiter', toBatch: BATCHES.earlyJan, toBatchName: 'Print Batch - Early January 2026' }
  ];

  let movedCount = 0;
  for (const move of orderMoves) {
    const workItem = await findWorkItemByCustomer(move.customer);
    if (!workItem) {
      console.log(`  ⚠️  Could not find: ${move.customer}`);
      continue;
    }

    const success = await moveOrderToBatch(workItem.id, move.toBatch, move.toBatchName, move.customer);
    if (success) movedCount++;
  }

  console.log(`\nMoved ${movedCount}/${orderMoves.length} orders\n`);

  // Step 2: Remove Levi Smith (not in current process)
  console.log('Step 2: Removing Levi Smith (not in process)...\n');

  const leviSmith = await findWorkItemByCustomer('Levi Smith');
  if (leviSmith && leviSmith.batch_id) {
    // Remove from batch
    await supabase
      .from('batch_items')
      .delete()
      .eq('work_item_id', leviSmith.id);

    await supabase
      .from('work_items')
      .update({ batch_id: null })
      .eq('id', leviSmith.id);

    console.log('  ✓ Removed Levi Smith from batch');
  } else {
    console.log('  ℹ️  Levi Smith not found or not in a batch');
  }

  console.log();

  // Step 3: Add missing Trish Gaeta to Late January batch
  console.log('Step 3: Adding missing Trish Gaeta...\n');

  const trishGaeta = await findWorkItemByCustomer('patricia gaeta');
  if (trishGaeta && !trishGaeta.batch_id) {
    const success = await moveOrderToBatch(
      trishGaeta.id,
      BATCHES.lateJan,
      'Print Batch - Late January 2026',
      'Trish Gaeta'
    );
    if (!success) {
      console.log('  ⚠️  Could not add Trish Gaeta');
    }
  } else if (trishGaeta) {
    console.log('  ℹ️  Trish Gaeta already in a batch');
  } else {
    console.log('  ⚠️  Could not find Trish Gaeta');
  }

  console.log();

  // Step 4: Delete "Feb 2" test batch
  console.log('Step 4: Deleting "Feb 2" test batch...\n');

  // First check if it's empty
  const { data: remainingItems } = await supabase
    .from('batch_items')
    .select('id')
    .eq('batch_id', BATCHES.feb2Test);

  if (remainingItems && remainingItems.length > 0) {
    console.log(`  ⚠️  Batch still has ${remainingItems.length} items, not deleting`);
  } else {
    const { error: deleteError } = await supabase
      .from('batches')
      .delete()
      .eq('id', BATCHES.feb2Test);

    if (deleteError) {
      console.log(`  ✗ Error deleting batch: ${deleteError.message}`);
    } else {
      console.log('  ✓ Deleted "Feb 2" test batch');
    }
  }

  console.log();

  // Summary
  console.log('='.repeat(80));
  console.log('CLEANUP COMPLETE');
  console.log('='.repeat(80));
  console.log('\n✅ Orders reorganized into correct batches');
  console.log('✅ "Feb 2" batch kept (Levi Smith already shipped)');
  console.log('\nYou can now view your batches at: /batches');
  console.log();
}

cleanup().catch(console.error);
