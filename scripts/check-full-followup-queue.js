const { createClient } = require('@supabase/supabase-js');

async function checkFullQueue() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseKey) {
    console.error('Missing Supabase credentials');
    process.exit(1);
  }

  const supabase = createClient(supabaseUrl, supabaseKey);

  console.log('Follow-Up Queue Status\n');
  console.log('='.repeat(80));

  // Get all open items with follow-up dates
  const { data: allItems, error } = await supabase
    .from('work_items')
    .select('id, customer_name, type, status, next_follow_up_at, created_at')
    .is('closed_at', null)
    .not('next_follow_up_at', 'is', null)
    .order('next_follow_up_at', { ascending: true });

  if (error) {
    console.error('Error:', error);
    process.exit(1);
  }

  const now = new Date();
  const sevenDaysFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

  // Items due now (overdue or due today)
  const dueNow = allItems.filter(item => new Date(item.next_follow_up_at) <= now);

  // Items due in next 7 days
  const dueSoon = allItems.filter(item => {
    const dueDate = new Date(item.next_follow_up_at);
    return dueDate > now && dueDate <= sevenDaysFromNow;
  });

  // Items due later
  const dueLater = allItems.filter(item => new Date(item.next_follow_up_at) > sevenDaysFromNow);

  console.log(`\n📋 OVERDUE / DUE NOW (${dueNow.length} items):`);
  if (dueNow.length > 0) {
    dueNow.forEach(item => {
      const daysOverdue = Math.floor((now - new Date(item.next_follow_up_at)) / (1000 * 60 * 60 * 24));
      console.log(`  🔴 ${item.customer_name}`);
      console.log(`     ${item.type} / ${item.status}`);
      console.log(`     Due: ${item.next_follow_up_at.split('T')[0]} (${daysOverdue} days ago)`);
      console.log();
    });
  } else {
    console.log('  (none)');
  }

  console.log(`\n⏰ DUE IN NEXT 7 DAYS (${dueSoon.length} items):`);
  if (dueSoon.length > 0) {
    dueSoon.forEach(item => {
      const daysUntil = Math.ceil((new Date(item.next_follow_up_at) - now) / (1000 * 60 * 60 * 24));
      console.log(`  🟡 ${item.customer_name}`);
      console.log(`     ${item.type} / ${item.status}`);
      console.log(`     Due: ${item.next_follow_up_at.split('T')[0]} (in ${daysUntil} days)`);
      console.log();
    });
  } else {
    console.log('  (none)');
  }

  console.log(`\n📅 DUE LATER (${dueLater.length} items):`);
  if (dueLater.length > 0) {
    dueLater.slice(0, 10).forEach(item => {
      console.log(`  ⚪ ${item.customer_name} - ${item.type}/${item.status} - Due: ${item.next_follow_up_at.split('T')[0]}`);
    });
    if (dueLater.length > 10) {
      console.log(`  ... and ${dueLater.length - 10} more`);
    }
  } else {
    console.log('  (none)');
  }

  console.log('\n' + '='.repeat(80));
  console.log(`\nTOTAL ITEMS WITH FOLLOW-UPS: ${allItems.length}`);

  // Check for batched/shipped items (should be zero)
  const batchedShipped = allItems.filter(item => item.status === 'batched' || item.status === 'shipped');
  if (batchedShipped.length > 0) {
    console.log(`\n❌ WARNING: ${batchedShipped.length} batched/shipped items still in queue!`);
  } else {
    console.log(`\n✅ No batched/shipped items in queue`);
  }
}

checkFullQueue();
