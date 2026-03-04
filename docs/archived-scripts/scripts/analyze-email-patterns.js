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

    console.log('\n=== EMAIL PATTERN ANALYSIS ===\n');
    console.log(`Total Emails: ${communications.length}\n`);

    // 1. Analyze email threads (conversations)
    const threads = {};
    communications.forEach(email => {
      if (email.provider_thread_id) {
        if (!threads[email.provider_thread_id]) {
          threads[email.provider_thread_id] = [];
        }
        threads[email.provider_thread_id].push(email);
      }
    });

    const threadLengths = Object.values(threads).map(t => t.length);
    const avgThreadLength = threadLengths.length > 0
      ? (threadLengths.reduce((a, b) => a + b, 0) / threadLengths.length).toFixed(2)
      : 0;

    console.log('=== CONVERSATION THREADS ===');
    console.log(`Total Threads: ${Object.keys(threads).length}`);
    console.log(`Average Messages per Thread: ${avgThreadLength}`);
    console.log(`Longest Thread: ${Math.max(...threadLengths, 0)} messages`);
    console.log(`Shortest Thread: ${Math.min(...threadLengths, Infinity)} messages\n`);

    // Find top 10 longest threads
    const sortedThreads = Object.entries(threads)
      .sort((a, b) => b[1].length - a[1].length)
      .slice(0, 10);

    console.log('=== TOP 10 LONGEST CONVERSATIONS ===');
    sortedThreads.forEach(([threadId, messages], index) => {
      const firstMsg = messages[messages.length - 1]; // oldest
      const lastMsg = messages[0]; // newest
      const participants = new Set();
      messages.forEach(m => {
        participants.add(m.from_email);
        m.to_emails.forEach(e => participants.add(e));
      });

      console.log(`\n[${index + 1}] ${messages.length} messages`);
      console.log(`    Subject: ${firstMsg.subject || '(no subject)'}`);
      console.log(`    Participants: ${Array.from(participants).join(', ')}`);
      console.log(`    Started: ${firstMsg.created_at}`);
      console.log(`    Last Message: ${lastMsg.created_at}`);
      console.log(`    Inbound: ${messages.filter(m => m.direction === 'inbound').length}`);
      console.log(`    Outbound: ${messages.filter(m => m.direction === 'outbound').length}`);
    });

    // 2. Analyze subject patterns
    console.log('\n\n=== EMAIL SUBJECT ANALYSIS ===');
    const subjectPatterns = {};
    communications.forEach(email => {
      const subject = email.subject || '(no subject)';
      // Extract key patterns
      if (subject.includes('Order') || subject.includes('order')) {
        subjectPatterns['Orders'] = (subjectPatterns['Orders'] || 0) + 1;
      } else if (subject.includes('sale') || subject.includes('Sale')) {
        subjectPatterns['Sales'] = (subjectPatterns['Sales'] || 0) + 1;
      } else if (subject.includes('Quote') || subject.includes('quote')) {
        subjectPatterns['Quotes'] = (subjectPatterns['Quotes'] || 0) + 1;
      } else if (subject.includes('Design') || subject.includes('design')) {
        subjectPatterns['Design'] = (subjectPatterns['Design'] || 0) + 1;
      } else if (subject.includes('Invoice') || subject.includes('invoice')) {
        subjectPatterns['Invoices'] = (subjectPatterns['Invoices'] || 0) + 1;
      } else if (subject.includes('Re:') || subject.includes('RE:')) {
        subjectPatterns['Replies'] = (subjectPatterns['Replies'] || 0) + 1;
      } else if (subject.includes('Fw:') || subject.includes('FW:')) {
        subjectPatterns['Forwards'] = (subjectPatterns['Forwards'] || 0) + 1;
      } else if (subject.includes('Automatic reply')) {
        subjectPatterns['Auto-replies'] = (subjectPatterns['Auto-replies'] || 0) + 1;
      } else if (subject.toLowerCase().includes('custom')) {
        subjectPatterns['Custom Orders'] = (subjectPatterns['Custom Orders'] || 0) + 1;
      } else {
        subjectPatterns['Other'] = (subjectPatterns['Other'] || 0) + 1;
      }
    });

    Object.entries(subjectPatterns)
      .sort((a, b) => b[1] - a[1])
      .forEach(([pattern, count]) => {
        console.log(`${pattern}: ${count}`);
      });

    // 3. Response time analysis
    console.log('\n\n=== RESPONSE TIME PATTERNS ===');
    const responseTimes = [];
    Object.values(threads).forEach(messages => {
      messages.sort((a, b) => new Date(a.created_at) - new Date(b.created_at));

      for (let i = 1; i < messages.length; i++) {
        const prev = messages[i - 1];
        const curr = messages[i];

        // If direction changed (someone responded)
        if (prev.direction !== curr.direction) {
          const timeDiff = new Date(curr.created_at) - new Date(prev.created_at);
          const hours = timeDiff / (1000 * 60 * 60);
          responseTimes.push({
            hours,
            respondedBy: curr.direction,
            from: prev.from_email,
            to: curr.from_email
          });
        }
      }
    });

    if (responseTimes.length > 0) {
      const avgResponseHours = responseTimes.reduce((sum, rt) => sum + rt.hours, 0) / responseTimes.length;
      const outboundResponses = responseTimes.filter(rt => rt.respondedBy === 'outbound');
      const inboundResponses = responseTimes.filter(rt => rt.respondedBy === 'inbound');

      console.log(`Total Responses: ${responseTimes.length}`);
      console.log(`Average Response Time: ${(avgResponseHours / 24).toFixed(1)} days (${avgResponseHours.toFixed(1)} hours)`);

      if (outboundResponses.length > 0) {
        const avgOutbound = outboundResponses.reduce((sum, rt) => sum + rt.hours, 0) / outboundResponses.length;
        console.log(`Your Response Time: ${(avgOutbound / 24).toFixed(1)} days (${avgOutbound.toFixed(1)} hours)`);
      }

      if (inboundResponses.length > 0) {
        const avgInbound = inboundResponses.reduce((sum, rt) => sum + rt.hours, 0) / inboundResponses.length;
        console.log(`Customer Response Time: ${(avgInbound / 24).toFixed(1)} days (${avgInbound.toFixed(1)} hours)`);
      }
    }

    // 4. Sample conversations - show real examples
    console.log('\n\n=== SAMPLE CONVERSATION THREADS ===');
    const sampleThreads = sortedThreads.slice(0, 3);

    sampleThreads.forEach(([threadId, messages], index) => {
      console.log(`\n\n--- CONVERSATION ${index + 1} ---`);
      console.log(`Subject: ${messages[0].subject || '(no subject)'}`);
      console.log(`Messages: ${messages.length}\n`);

      // Sort chronologically
      const sorted = [...messages].sort((a, b) => new Date(a.created_at) - new Date(b.created_at));

      sorted.slice(0, 10).forEach((msg, i) => { // Show first 10 messages
        const date = new Date(msg.created_at).toLocaleDateString();
        console.log(`[${i + 1}] ${date} - ${msg.direction.toUpperCase()}`);
        console.log(`    From: ${msg.from_email}`);
        console.log(`    To: ${msg.to_emails.join(', ')}`);
        if (msg.body_preview) {
          console.log(`    Preview: ${msg.body_preview.substring(0, 200)}...`);
        }
        console.log('');
      });

      if (sorted.length > 10) {
        console.log(`    ... and ${sorted.length - 10} more messages\n`);
      }
    });

    // 5. Email categories
    console.log('\n\n=== EMAIL CATEGORIES ===');
    const categories = {
      'Customer Inquiries': 0,
      'Order Confirmations': 0,
      'Sales Notifications': 0,
      'Design Reviews': 0,
      'Automated/System': 0,
      'Business Correspondence': 0,
      'Other': 0
    };

    communications.forEach(email => {
      const from = email.from_email.toLowerCase();
      const subject = (email.subject || '').toLowerCase();

      if (from.includes('shopify') || from.includes('etsy')) {
        if (subject.includes('sale') || subject.includes('order')) {
          categories['Sales Notifications']++;
        } else {
          categories['Automated/System']++;
        }
      } else if (subject.includes('design') || subject.includes('proof') || subject.includes('approval')) {
        categories['Design Reviews']++;
      } else if (from.includes('noreply') || from.includes('notification') || subject.includes('automatic reply')) {
        categories['Automated/System']++;
      } else if (email.direction === 'inbound' && !from.includes('sales@thegayfanclub.com')) {
        categories['Customer Inquiries']++;
      } else if (email.direction === 'inbound') {
        categories['Business Correspondence']++;
      } else {
        categories['Other']++;
      }
    });

    Object.entries(categories).forEach(([category, count]) => {
      const percent = ((count / communications.length) * 100).toFixed(1);
      console.log(`${category}: ${count} (${percent}%)`);
    });

  } catch (err) {
    console.error('Error:', err);
    process.exit(1);
  }
})();
