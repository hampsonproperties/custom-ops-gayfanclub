const { createClient } = require('@supabase/supabase-js');

async function recalculateFollowUps() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseKey) {
    console.error('Missing Supabase credentials');
    process.exit(1);
  }

  const supabase = createClient(supabaseUrl, supabaseKey);

  console.log('Recalculating follow-ups for all batched/shipped items...\n');

  // First, fetch all batched/shipped items
  const { data: items, error: fetchError } = await supabase
    .from('work_items')
    .select('id, customer_name, type, status, next_follow_up_at')
    .in('status', ['batched', 'shipped'])
    .is('closed_at', null);

  if (fetchError) {
    console.error('Error fetching items:', fetchError);
    process.exit(1);
  }

  if (!items || items.length === 0) {
    console.log('No batched/shipped items found to update');
    return;
  }

  console.log(`Found ${items.length} items to recalculate\n`);

  // Recalculate each item
  const results = [];
  for (const item of items) {
    console.log(`Processing: ${item.customer_name} (${item.type}/${item.status})`);

    // Call the calculate_next_follow_up function
    const { data: newFollowUpDate, error: calcError } = await supabase
      .rpc('calculate_next_follow_up', { work_item_id: item.id });

    if (calcError) {
      console.error(`  → Error calculating for ${item.id}:`, calcError);
      continue;
    }

    // Update the work item with the new follow-up date
    const { error: updateError } = await supabase
      .from('work_items')
      .update({ next_follow_up_at: newFollowUpDate })
      .eq('id', item.id);

    if (updateError) {
      console.error(`  → Error updating ${item.id}:`, updateError);
      continue;
    }

    console.log(`  → Updated: next_follow_up_at = ${newFollowUpDate || 'NULL'}`);
    results.push({
      ...item,
      next_follow_up_at: newFollowUpDate
    });
  }

  console.log('\nRecalculation completed!\n');
  console.log('Summary:');
  results.forEach(item => {
    console.log(`  - ${item.customer_name} (${item.type}/${item.status}): ${item.next_follow_up_at || 'NULL'}`);
  });
  console.log(`\nTotal: ${results.length} items updated successfully`);
}

recalculateFollowUps();
