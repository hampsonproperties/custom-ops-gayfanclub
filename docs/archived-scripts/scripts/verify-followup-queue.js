const { createClient } = require('@supabase/supabase-js');

async function verifyFollowUpQueue() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseKey) {
    console.error('Missing Supabase credentials');
    process.exit(1);
  }

  const supabase = createClient(supabaseUrl, supabaseKey);

  console.log('Verifying follow-up queue...\n');

  // Check for any batched/shipped items with follow-up dates
  const { data: batchedShippedWithFollowUps, error: error1 } = await supabase
    .from('work_items')
    .select('id, customer_name, type, status, next_follow_up_at')
    .in('status', ['batched', 'shipped'])
    .is('closed_at', null)
    .not('next_follow_up_at', 'is', null);

  if (error1) {
    console.error('Error checking batched/shipped items:', error1);
    process.exit(1);
  }

  console.log('1. Batched/Shipped items with follow-up dates (should be empty):');
  if (batchedShippedWithFollowUps && batchedShippedWithFollowUps.length > 0) {
    console.log('  ❌ ISSUE FOUND! These items still have follow-up dates:');
    batchedShippedWithFollowUps.forEach(item => {
      console.log(`     - ${item.customer_name} (${item.type}/${item.status}): ${item.next_follow_up_at}`);
    });
  } else {
    console.log('  ✅ No batched/shipped items have follow-up dates');
  }

  // Check all batched/shipped items to confirm NULL
  const { data: allBatchedShipped, error: error2 } = await supabase
    .from('work_items')
    .select('id, customer_name, type, status, next_follow_up_at')
    .in('status', ['batched', 'shipped'])
    .is('closed_at', null);

  if (error2) {
    console.error('Error fetching all batched/shipped items:', error2);
    process.exit(1);
  }

  console.log('\n2. All batched/shipped items (should all have next_follow_up_at = NULL):');
  console.log(`  Total: ${allBatchedShipped.length} items`);
  const allNull = allBatchedShipped.every(item => item.next_follow_up_at === null);
  if (allNull) {
    console.log('  ✅ All items have next_follow_up_at = NULL');
  } else {
    console.log('  ❌ Some items still have follow-up dates!');
  }

  // Check what's currently in the follow-up queue (items due for follow-up)
  const now = new Date().toISOString();
  const { data: queueItems, error: error3 } = await supabase
    .from('work_items')
    .select('id, customer_name, type, status, next_follow_up_at')
    .is('closed_at', null)
    .not('next_follow_up_at', 'is', null)
    .lte('next_follow_up_at', now)
    .order('next_follow_up_at', { ascending: true });

  if (error3) {
    console.error('Error fetching queue items:', error3);
    process.exit(1);
  }

  console.log('\n3. Current follow-up queue (items due now):');
  if (queueItems && queueItems.length > 0) {
    console.log(`  Found ${queueItems.length} items in queue:`);
    queueItems.forEach(item => {
      console.log(`    - ${item.customer_name} (${item.type}/${item.status}): ${item.next_follow_up_at}`);
    });

    const batchedOrShippedInQueue = queueItems.filter(item =>
      item.status === 'batched' || item.status === 'shipped'
    );

    if (batchedOrShippedInQueue.length > 0) {
      console.log('\n  ❌ ERROR: Batched/shipped items found in queue:');
      batchedOrShippedInQueue.forEach(item => {
        console.log(`     - ${item.customer_name} (${item.type}/${item.status})`);
      });
    } else {
      console.log('\n  ✅ No batched/shipped items in the queue');
    }
  } else {
    console.log('  Queue is empty');
  }

  console.log('\n✅ Verification complete!');
}

verifyFollowUpQueue();
