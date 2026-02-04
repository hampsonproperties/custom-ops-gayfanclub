/**
 * Remove Already-Shipped Orders
 *
 * This script removes orders that were already shipped in December
 * and shouldn't be in the active system.
 */

const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function removeShippedOrders() {
  console.log('='.repeat(80));
  console.log('REMOVING ALREADY-SHIPPED ORDERS');
  console.log('='.repeat(80));
  console.log();

  const ordersToRemove = [
    { customer: 'Levi Smith', orderNumber: '#6446' },
    { customer: 'Nicholas Grigsby', orderNumber: '#6449' }
  ];

  let removedCount = 0;

  for (const orderInfo of ordersToRemove) {
    console.log(`Removing ${orderInfo.customer} - Order ${orderInfo.orderNumber}...`);

    // Find the work item
    const { data: workItems } = await supabase
      .from('work_items')
      .select('id, customer_name, batch_id')
      .ilike('customer_name', `%${orderInfo.customer}%`);

    if (!workItems || workItems.length === 0) {
      console.log(`  ⚠️  Not found`);
      continue;
    }

    const workItem = workItems[0];

    // Remove from batch if in one
    if (workItem.batch_id) {
      await supabase
        .from('batch_items')
        .delete()
        .eq('work_item_id', workItem.id);
      console.log(`  ✓ Removed from batch`);
    }

    // Delete the work item
    const { error: deleteError } = await supabase
      .from('work_items')
      .delete()
      .eq('id', workItem.id);

    if (deleteError) {
      console.log(`  ✗ Error deleting: ${deleteError.message}`);
    } else {
      console.log(`  ✓ Deleted from system`);
      removedCount++;
    }

    console.log();
  }

  console.log('='.repeat(80));
  console.log('REMOVAL COMPLETE');
  console.log('='.repeat(80));
  console.log(`\n✅ Removed ${removedCount}/${ordersToRemove.length} already-shipped orders`);
  console.log('\nThese December orders were already completed and shipped.');
  console.log();
}

removeShippedOrders().catch(console.error);
