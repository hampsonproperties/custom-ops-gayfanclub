/**
 * Backfill Missing Emails
 *
 * Attempts to find and backfill missing customer emails from:
 * 1. Other work items with the same customer name
 * 2. Customer records in the database
 * 3. Shopify API (if available)
 */

const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function backfillEmails() {
  console.log('================================================================================');
  console.log('BACKFILL MISSING EMAILS');
  console.log('================================================================================\n');

  // Find all work items with missing emails
  const { data: itemsWithoutEmail, error } = await supabase
    .from('work_items')
    .select('id, customer_name, shopify_order_number, status')
    .or('customer_email.is.null,customer_email.eq.');

  if (error) {
    console.error('Error fetching work items:', error);
    return;
  }

  console.log(`Found ${itemsWithoutEmail.length} work items without emails\n`);

  if (itemsWithoutEmail.length === 0) {
    console.log('No emails to backfill!');
    return;
  }

  const updates = [];

  for (const item of itemsWithoutEmail) {
    console.log(`\nSearching for email: ${item.customer_name} (Order #${item.shopify_order_number})`);

    // Strategy 1: Find email from other work items with same customer name
    const { data: otherItems, error: searchError } = await supabase
      .from('work_items')
      .select('customer_email')
      .ilike('customer_name', item.customer_name)
      .not('customer_email', 'is', null)
      .neq('customer_email', '')
      .limit(1);

    if (searchError) {
      console.error(`  ✗ Error searching: ${searchError.message}`);
      continue;
    }

    if (otherItems && otherItems.length > 0 && otherItems[0].customer_email) {
      const email = otherItems[0].customer_email;
      console.log(`  ✓ Found email from other work item: ${email}`);
      updates.push({
        id: item.id,
        customer_name: item.customer_name,
        email: email,
        source: 'other_work_items'
      });
      continue;
    }

    // Strategy 2: Check customers table if it exists
    const { data: customerRecord, error: customerError } = await supabase
      .from('customers')
      .select('email')
      .ilike('name', item.customer_name)
      .limit(1)
      .maybeSingle();

    if (customerRecord && customerRecord.email) {
      const email = customerRecord.email;
      console.log(`  ✓ Found email from customers table: ${email}`);
      updates.push({
        id: item.id,
        customer_name: item.customer_name,
        email: email,
        source: 'customers_table'
      });
      continue;
    }

    console.log(`  ✗ No email found`);
  }

  // Print summary
  console.log('\n================================================================================');
  console.log('SUMMARY');
  console.log('================================================================================\n');

  console.log(`Total work items without emails: ${itemsWithoutEmail.length}`);
  console.log(`Emails found: ${updates.length}`);
  console.log(`Still missing: ${itemsWithoutEmail.length - updates.length}\n`);

  if (updates.length === 0) {
    console.log('No emails to update.');
    return;
  }

  console.log('Found emails for:');
  updates.forEach(u => {
    console.log(`  • ${u.customer_name} - ${u.email} (from ${u.source})`);
  });

  console.log('\nApplying updates...\n');

  // Apply updates
  for (const update of updates) {
    const { error: updateError } = await supabase
      .from('work_items')
      .update({ customer_email: update.email })
      .eq('id', update.id);

    if (updateError) {
      console.error(`  ✗ Failed to update ${update.customer_name}: ${updateError.message}`);
    } else {
      console.log(`  ✓ Updated ${update.customer_name}`);
    }
  }

  console.log('\nBackfill complete!');
}

backfillEmails()
  .then(() => process.exit(0))
  .catch(err => {
    console.error('Backfill failed:', err);
    process.exit(1);
  });
