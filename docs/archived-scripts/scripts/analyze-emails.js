const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

(async () => {
  try {
    const { data: communications, error } = await supabase
      .from('communications')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error:', error);
      process.exit(1);
    }

    // Analyze senders
    const senderCounts = {};
    const customerEmails = [];
    const systemEmails = [];

    communications.forEach(email => {
      // Count senders
      senderCounts[email.from_email] = (senderCounts[email.from_email] || 0) + 1;

      // Separate customer inquiries from system emails
      const isSystemEmail = email.from_email.includes('shopify.com') ||
                           email.from_email.includes('noreply') ||
                           email.from_email.includes('mailer@');

      if (isSystemEmail) {
        systemEmails.push(email);
      } else if (email.direction === 'inbound') {
        customerEmails.push(email);
      }
    });

    console.log('\n=== EMAIL BREAKDOWN ===\n');
    console.log(`Total Emails: ${communications.length}`);
    console.log(`Customer Inquiries (non-system inbound): ${customerEmails.length}`);
    console.log(`System/Automated Emails: ${systemEmails.length}`);
    console.log(`Outbound Emails: ${communications.filter(e => e.direction === 'outbound').length}\n`);

    console.log('=== TOP 10 SENDERS ===');
    const sortedSenders = Object.entries(senderCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10);

    sortedSenders.forEach(([email, count]) => {
      console.log(`${email}: ${count} emails`);
    });

    console.log('\n=== RECENT CUSTOMER INQUIRIES (Last 20) ===\n');
    customerEmails.slice(0, 20).forEach((email, index) => {
      console.log(`[${index + 1}] From: ${email.from_email}`);
      console.log(`    Subject: ${email.subject || '(no subject)'}`);
      console.log(`    Date: ${email.sent_at || email.received_at}`);
      console.log(`    Preview: ${email.body_preview ? email.body_preview.substring(0, 150) : '(no preview)'}...`);
      console.log(`    Status: ${email.triage_status}`);
      console.log(`    Linked to Work Item: ${email.work_item_id ? 'Yes' : 'No'}`);
      console.log('');
    });

    console.log(`\n=== UNTRIAGED CUSTOMER EMAILS ===`);
    const untriagedCustomer = customerEmails.filter(e => e.triage_status === 'untriaged');
    console.log(`Count: ${untriagedCustomer.length}\n`);

  } catch (err) {
    console.error('Error:', err);
    process.exit(1);
  }
})();
