const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

(async () => {
  try {
    // Query all communications
    const { data: communications, error } = await supabase
      .from('communications')
      .select(`
        id,
        direction,
        from_email,
        to_emails,
        cc_emails,
        subject,
        body_preview,
        triage_status,
        sent_at,
        received_at,
        created_at,
        work_item_id,
        customer_id,
        has_attachments
      `)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error querying communications:', error);
      process.exit(1);
    }

    console.log(`\n=== TOTAL EMAILS IN SYSTEM: ${communications.length} ===\n`);

    if (communications.length === 0) {
      console.log('No emails found in the database.');
      return;
    }

    // Group by direction
    const inbound = communications.filter(c => c.direction === 'inbound');
    const outbound = communications.filter(c => c.direction === 'outbound');

    console.log(`Inbound: ${inbound.length}`);
    console.log(`Outbound: ${outbound.length}\n`);

    // Show email details
    console.log('=== EMAIL DETAILS ===\n');

    communications.forEach((email, index) => {
      console.log(`[${index + 1}] ${email.direction.toUpperCase()}`);
      console.log(`    From: ${email.from_email}`);
      console.log(`    To: ${email.to_emails.join(', ')}`);
      if (email.cc_emails && email.cc_emails.length > 0) {
        console.log(`    CC: ${email.cc_emails.join(', ')}`);
      }
      console.log(`    Subject: ${email.subject || '(no subject)'}`);
      console.log(`    Preview: ${email.body_preview ? email.body_preview.substring(0, 100) + '...' : '(no preview)'}`);
      console.log(`    Triage Status: ${email.triage_status}`);
      console.log(`    Date: ${email.sent_at || email.received_at || email.created_at}`);
      console.log(`    Work Item ID: ${email.work_item_id || 'None'}`);
      console.log(`    Customer ID: ${email.customer_id || 'None'}`);
      console.log(`    Has Attachments: ${email.has_attachments ? 'Yes' : 'No'}`);
      console.log('');
    });

    // Summary by triage status
    console.log('\n=== TRIAGE STATUS SUMMARY ===');
    const triageGroups = communications.reduce((acc, email) => {
      acc[email.triage_status] = (acc[email.triage_status] || 0) + 1;
      return acc;
    }, {});

    Object.entries(triageGroups).forEach(([status, count]) => {
      console.log(`${status}: ${count}`);
    });

  } catch (err) {
    console.error('Unexpected error:', err);
    process.exit(1);
  }
})();
