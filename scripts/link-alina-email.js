/**
 * Link Alina Arciga's form submission email to her work item
 */

const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function linkEmail() {
  console.log('Finding Alina Arciga work item and form email...\n');

  // Find the work item
  const { data: workItem, error: workItemError } = await supabase
    .from('work_items')
    .select('id, customer_name, customer_email')
    .eq('customer_email', 'Alina.arciga@gmail.com')
    .single();

  if (workItemError || !workItem) {
    console.error('Could not find work item:', workItemError);
    return;
  }

  console.log('Found work item:');
  console.log(`  ID: ${workItem.id}`);
  console.log(`  Customer: ${workItem.customer_name}`);
  console.log(`  Email: ${workItem.customer_email}\n`);

  // Find the form submission email (from PowerfulForm)
  const { data: emails, error: emailError } = await supabase
    .from('communications')
    .select('*')
    .eq('from_email', 'no-reply@powerfulform.com')
    .ilike('subject', '%Alina Arciga%')
    .order('received_at', { ascending: false });

  if (emailError || !emails || emails.length === 0) {
    console.error('Could not find email:', emailError);
    return;
  }

  console.log(`Found ${emails.length} matching email(s):\n`);

  for (const email of emails) {
    console.log(`  From: ${email.from_email}`);
    console.log(`  Subject: ${email.subject}`);
    console.log(`  Received: ${email.received_at}`);
    console.log(`  Triage Status: ${email.triage_status}`);
    console.log(`  Current Work Item: ${email.work_item_id || 'none'}\n`);

    // Link it if not already linked to this work item
    if (email.work_item_id !== workItem.id) {
      console.log('Linking email to work item...');

      const { error: updateError } = await supabase
        .from('communications')
        .update({
          work_item_id: workItem.id,
          triage_status: 'attached',
        })
        .eq('id', email.id);

      if (updateError) {
        console.error('Failed to link:', updateError);
      } else {
        console.log('✓ Email linked successfully!\n');
      }
    } else {
      console.log('Email already linked to this work item\n');
    }
  }

  console.log('Done! Refresh the work item page to see the email.');
}

linkEmail()
  .then(() => process.exit(0))
  .catch(err => {
    console.error('Failed:', err);
    process.exit(1);
  });
