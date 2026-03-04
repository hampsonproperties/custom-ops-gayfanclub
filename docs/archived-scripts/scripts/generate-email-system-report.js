const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

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

    const report = [];

    report.push('# EMAIL SYSTEM ANALYSIS REPORT');
    report.push(`Generated: ${new Date().toLocaleString()}`);
    report.push(`Total Emails Analyzed: ${communications.length}`);
    report.push('\n---\n');

    // ========================================
    // EXECUTIVE SUMMARY
    // ========================================
    report.push('## EXECUTIVE SUMMARY\n');

    const inbound = communications.filter(c => c.direction === 'inbound');
    const outbound = communications.filter(c => c.direction === 'outbound');
    const untriaged = communications.filter(c => c.triage_status === 'untriaged');

    report.push(`- **Total Emails**: ${communications.length}`);
    report.push(`- **Inbound**: ${inbound.length} (${((inbound.length/communications.length)*100).toFixed(1)}%)`);
    report.push(`- **Outbound**: ${outbound.length} (${((outbound.length/communications.length)*100).toFixed(1)}%)`);
    report.push(`- **Untriaged**: ${untriaged.length} (${((untriaged.length/communications.length)*100).toFixed(1)}%)`);
    report.push(`- **Linked to Work Items**: ${communications.filter(c => c.work_item_id).length}`);
    report.push(`- **Orphaned (No Work Item)**: ${communications.filter(c => !c.work_item_id).length}`);
    report.push('\n');

    // ========================================
    // EMAIL CATEGORIES
    // ========================================
    report.push('## EMAIL CATEGORIES\n');

    const categories = {
      'Customer Inquiries': [],
      'Custom Order Requests': [],
      'Design Approval/Review': [],
      'Order Issues/Support': [],
      'Shopify Orders': [],
      'Etsy Sales': [],
      'Business/B2B': [],
      'Automated/System': [],
      'Spam/Irrelevant': [],
      'Unknown': []
    };

    communications.forEach(email => {
      const from = email.from_email.toLowerCase();
      const subject = (email.subject || '').toLowerCase();
      const preview = (email.body_preview || '').toLowerCase();

      if (from.includes('etsy.com') && subject.includes('sale')) {
        categories['Etsy Sales'].push(email);
      } else if (from.includes('shopify.com') && (subject.includes('order') || subject.includes('customer message'))) {
        categories['Shopify Orders'].push(email);
      } else if (from.includes('shopify.com') || from.includes('etsy.com')) {
        categories['Automated/System'].push(email);
      } else if (subject.includes('design') || subject.includes('proof') || subject.includes('approval') || subject.includes('mockup')) {
        categories['Design Approval/Review'].push(email);
      } else if (subject.includes('missing') || subject.includes('issue') || subject.includes('problem') || subject.includes('wrong')) {
        categories['Order Issues/Support'].push(email);
      } else if (subject.includes('custom') && email.direction === 'inbound') {
        categories['Custom Order Requests'].push(email);
      } else if (from.includes('loreal.com') || from.includes('ritz') || subject.includes('vendor') || subject.includes('1099')) {
        categories['Business/B2B'].push(email);
      } else if (from.includes('noreply') || from.includes('notification') || from.includes('mailer@') || subject.includes('automatic reply') || from.includes('substack') || from.includes('ringcentral') || from.includes('tiktok')) {
        categories['Spam/Irrelevant'].push(email);
      } else if (email.direction === 'inbound' && from !== 'sales@thegayfanclub.com') {
        categories['Customer Inquiries'].push(email);
      } else {
        categories['Unknown'].push(email);
      }
    });

    Object.entries(categories).forEach(([category, emails]) => {
      const percent = ((emails.length / communications.length) * 100).toFixed(1);
      report.push(`### ${category}: ${emails.length} (${percent}%)`);

      if (emails.length > 0) {
        // Show examples
        const examples = emails.slice(0, 3);
        report.push('**Examples:**');
        examples.forEach(email => {
          report.push(`- From: ${email.from_email}`);
          report.push(`  Subject: ${email.subject || '(no subject)'}`);
          report.push(`  Date: ${new Date(email.created_at).toLocaleDateString()}`);
        });
      }
      report.push('\n');
    });

    // ========================================
    // WORKFLOW PATTERNS
    // ========================================
    report.push('## WORKFLOW PATTERNS\n');

    // Group by threads
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

    report.push(`- **Total Conversation Threads**: ${Object.keys(threads).length}`);
    report.push(`- **Average Messages per Thread**: ${avgThreadLength}`);
    report.push(`- **Single Message Threads**: ${threadLengths.filter(l => l === 1).length}`);
    report.push(`- **Multi-Message Threads (2-5)**: ${threadLengths.filter(l => l >= 2 && l <= 5).length}`);
    report.push(`- **Extended Threads (6-10)**: ${threadLengths.filter(l => l >= 6 && l <= 10).length}`);
    report.push(`- **Long Threads (11+)**: ${threadLengths.filter(l => l > 10).length}`);
    report.push('\n');

    // Analyze common workflows
    report.push('### Common Customer Journey Patterns\n');

    const journeys = {
      'Quick Info Request': 0,
      'Custom Order Process': 0,
      'Design Iteration': 0,
      'Issue Resolution': 0,
      'Complex B2B': 0
    };

    Object.values(threads).forEach(messages => {
      if (messages.length === 1) {
        journeys['Quick Info Request']++;
      } else if (messages.length >= 2 && messages.length <= 5) {
        const subjects = messages.map(m => (m.subject || '').toLowerCase());
        if (subjects.some(s => s.includes('design') || s.includes('proof'))) {
          journeys['Design Iteration']++;
        } else if (subjects.some(s => s.includes('issue') || s.includes('missing'))) {
          journeys['Issue Resolution']++;
        } else {
          journeys['Custom Order Process']++;
        }
      } else if (messages.length >= 6 && messages.length <= 15) {
        journeys['Design Iteration']++;
      } else {
        journeys['Complex B2B']++;
      }
    });

    Object.entries(journeys).forEach(([journey, count]) => {
      const percent = Object.keys(threads).length > 0
        ? ((count / Object.keys(threads).length) * 100).toFixed(1)
        : 0;
      report.push(`- **${journey}**: ${count} threads (${percent}%)`);
    });
    report.push('\n');

    // ========================================
    // RESPONSE TIME ANALYSIS
    // ========================================
    report.push('## RESPONSE TIME ANALYSIS\n');

    const responseTimes = [];
    Object.values(threads).forEach(messages => {
      messages.sort((a, b) => new Date(a.created_at) - new Date(b.created_at));

      for (let i = 1; i < messages.length; i++) {
        const prev = messages[i - 1];
        const curr = messages[i];

        if (prev.direction !== curr.direction) {
          const timeDiff = new Date(curr.created_at) - new Date(prev.created_at);
          const hours = timeDiff / (1000 * 60 * 60);
          responseTimes.push({
            hours,
            days: hours / 24,
            respondedBy: curr.direction,
            from: prev.from_email,
            to: curr.from_email
          });
        }
      }
    });

    if (responseTimes.length > 0) {
      const outboundResponses = responseTimes.filter(rt => rt.respondedBy === 'outbound');
      const inboundResponses = responseTimes.filter(rt => rt.respondedBy === 'inbound');

      report.push(`**Total Response Interactions**: ${responseTimes.length}\n`);

      if (outboundResponses.length > 0) {
        const avgHours = outboundResponses.reduce((sum, rt) => sum + rt.hours, 0) / outboundResponses.length;
        const medianHours = outboundResponses.map(rt => rt.hours).sort((a, b) => a - b)[Math.floor(outboundResponses.length / 2)];

        report.push('### Your Response Time (Outbound)');
        report.push(`- **Average**: ${avgHours.toFixed(1)} hours (${(avgHours/24).toFixed(1)} days)`);
        report.push(`- **Median**: ${medianHours.toFixed(1)} hours (${(medianHours/24).toFixed(1)} days)`);
        report.push(`- **Fastest**: ${Math.min(...outboundResponses.map(rt => rt.hours)).toFixed(1)} hours`);
        report.push(`- **Slowest**: ${Math.max(...outboundResponses.map(rt => rt.hours)).toFixed(1)} hours (${(Math.max(...outboundResponses.map(rt => rt.hours))/24).toFixed(1)} days)`);

        // Response time buckets
        const under1hour = outboundResponses.filter(rt => rt.hours < 1).length;
        const under4hours = outboundResponses.filter(rt => rt.hours >= 1 && rt.hours < 4).length;
        const under24hours = outboundResponses.filter(rt => rt.hours >= 4 && rt.hours < 24).length;
        const under48hours = outboundResponses.filter(rt => rt.hours >= 24 && rt.hours < 48).length;
        const over48hours = outboundResponses.filter(rt => rt.hours >= 48).length;

        report.push('\n**Response Time Distribution:**');
        report.push(`- Under 1 hour: ${under1hour} (${((under1hour/outboundResponses.length)*100).toFixed(1)}%)`);
        report.push(`- 1-4 hours: ${under4hours} (${((under4hours/outboundResponses.length)*100).toFixed(1)}%)`);
        report.push(`- 4-24 hours: ${under24hours} (${((under24hours/outboundResponses.length)*100).toFixed(1)}%)`);
        report.push(`- 24-48 hours: ${under48hours} (${((under48hours/outboundResponses.length)*100).toFixed(1)}%)`);
        report.push(`- Over 48 hours: ${over48hours} (${((over48hours/outboundResponses.length)*100).toFixed(1)}%)`);
        report.push('\n');
      }

      if (inboundResponses.length > 0) {
        const avgHours = inboundResponses.reduce((sum, rt) => sum + rt.hours, 0) / inboundResponses.length;
        report.push('### Customer Response Time (Inbound)');
        report.push(`- **Average**: ${avgHours.toFixed(1)} hours (${(avgHours/24).toFixed(1)} days)`);
        report.push('\n');
      }
    }

    // ========================================
    // TRIAGE STATUS ANALYSIS
    // ========================================
    report.push('## TRIAGE STATUS ANALYSIS\n');

    const triageGroups = communications.reduce((acc, email) => {
      acc[email.triage_status] = (acc[email.triage_status] || 0) + 1;
      return acc;
    }, {});

    Object.entries(triageGroups).forEach(([status, count]) => {
      const percent = ((count / communications.length) * 100).toFixed(1);
      report.push(`- **${status}**: ${count} (${percent}%)`);
    });
    report.push('\n');

    report.push('### Untriaged Breakdown by Category\n');
    const untriagedByCategory = {};
    untriaged.forEach(email => {
      const from = email.from_email.toLowerCase();
      const subject = (email.subject || '').toLowerCase();

      let category = 'Other';
      if (from.includes('etsy.com')) category = 'Etsy';
      else if (from.includes('shopify.com')) category = 'Shopify';
      else if (subject.includes('design') || subject.includes('proof')) category = 'Design Review';
      else if (from.includes('loreal') || subject.includes('vendor')) category = 'B2B';
      else if (from.includes('noreply') || from.includes('notification')) category = 'Automated/Spam';
      else if (email.direction === 'inbound') category = 'Customer Inquiry';

      untriagedByCategory[category] = (untriagedByCategory[category] || 0) + 1;
    });

    Object.entries(untriagedByCategory)
      .sort((a, b) => b[1] - a[1])
      .forEach(([category, count]) => {
        report.push(`- ${category}: ${count}`);
      });
    report.push('\n');

    // ========================================
    // WORK ITEM LINKAGE
    // ========================================
    report.push('## WORK ITEM LINKAGE ANALYSIS\n');

    const linked = communications.filter(c => c.work_item_id);
    const orphaned = communications.filter(c => !c.work_item_id);

    report.push(`- **Linked to Work Items**: ${linked.length} (${((linked.length/communications.length)*100).toFixed(1)}%)`);
    report.push(`- **Orphaned (No Work Item)**: ${orphaned.length} (${((orphaned.length/communications.length)*100).toFixed(1)}%)`);
    report.push('\n');

    report.push('### Orphaned Emails by Category\n');
    const orphanedByCategory = {};
    orphaned.forEach(email => {
      const from = email.from_email.toLowerCase();
      const subject = (email.subject || '').toLowerCase();

      let category = 'Other';
      if (from.includes('etsy.com')) category = 'Etsy (likely needs work item)';
      else if (from.includes('shopify.com')) category = 'Shopify (likely needs work item)';
      else if (from === 'sales@thegayfanclub.com') category = 'Outbound (may not need work item)';
      else if (from.includes('noreply') || from.includes('notification') || from.includes('substack')) category = 'Spam/Automated (no work item needed)';
      else if (email.direction === 'inbound') category = 'Customer Inquiry (NEEDS WORK ITEM)';

      orphanedByCategory[category] = (orphanedByCategory[category] || 0) + 1;
    });

    Object.entries(orphanedByCategory)
      .sort((a, b) => b[1] - a[1])
      .forEach(([category, count]) => {
        const percent = ((count / orphaned.length) * 100).toFixed(1);
        report.push(`- ${category}: ${count} (${percent}%)`);
      });
    report.push('\n');

    // ========================================
    // CUSTOMER ANALYSIS
    // ========================================
    report.push('## CUSTOMER COMMUNICATION ANALYSIS\n');

    const customerEmails = {};
    communications.forEach(email => {
      if (email.direction === 'inbound' && email.from_email !== 'sales@thegayfanclub.com') {
        if (!customerEmails[email.from_email]) {
          customerEmails[email.from_email] = [];
        }
        customerEmails[email.from_email].push(email);
      }
    });

    const uniqueCustomers = Object.keys(customerEmails).length;
    report.push(`- **Unique Customer Email Addresses**: ${uniqueCustomers}`);
    report.push(`- **Average Emails per Customer**: ${(inbound.length / uniqueCustomers).toFixed(1)}`);
    report.push('\n');

    report.push('### Top 15 Most Active Customers\n');
    const sortedCustomers = Object.entries(customerEmails)
      .sort((a, b) => b[1].length - a[1].length)
      .slice(0, 15);

    sortedCustomers.forEach(([email, emails], index) => {
      const linkedCount = emails.filter(e => e.work_item_id).length;
      report.push(`${index + 1}. **${email}**: ${emails.length} emails (${linkedCount} linked to work items)`);
    });
    report.push('\n');

    // ========================================
    // ATTACHMENT ANALYSIS
    // ========================================
    report.push('## ATTACHMENT ANALYSIS\n');

    const withAttachments = communications.filter(c => c.has_attachments);
    report.push(`- **Emails with Attachments**: ${withAttachments.length} (${((withAttachments.length/communications.length)*100).toFixed(1)}%)`);
    report.push(`- **Inbound with Attachments**: ${withAttachments.filter(e => e.direction === 'inbound').length}`);
    report.push(`- **Outbound with Attachments**: ${withAttachments.filter(e => e.direction === 'outbound').length}`);
    report.push('\n');

    // ========================================
    // PROBLEMS & PAIN POINTS
    // ========================================
    report.push('## IDENTIFIED PROBLEMS & PAIN POINTS\n');

    const problems = [];

    if (untriaged.length > 500) {
      problems.push(`🔴 **CRITICAL**: ${untriaged.length} untriaged emails - massive backlog requiring immediate attention`);
    }

    if (orphaned.length > 700) {
      problems.push(`🔴 **CRITICAL**: ${orphaned.length} emails not linked to work items - losing track of customer interactions`);
    }

    const customerInquiriesNoWorkItem = orphaned.filter(e => {
      const from = e.from_email.toLowerCase();
      return e.direction === 'inbound' &&
             !from.includes('shopify.com') &&
             !from.includes('etsy.com') &&
             !from.includes('noreply') &&
             !from.includes('notification');
    });

    if (customerInquiriesNoWorkItem.length > 100) {
      problems.push(`🟡 **HIGH PRIORITY**: ${customerInquiriesNoWorkItem.length} customer inquiries not linked to work items`);
    }

    const multiMessageNoWorkItem = Object.values(threads)
      .filter(messages => messages.length > 3 && !messages[0].work_item_id)
      .length;

    if (multiMessageNoWorkItem > 20) {
      problems.push(`🟡 **HIGH PRIORITY**: ${multiMessageNoWorkItem} multi-message conversations have no work items`);
    }

    const slowResponses = responseTimes.filter(rt => rt.respondedBy === 'outbound' && rt.hours > 48).length;
    if (slowResponses > 5) {
      problems.push(`🟠 **MEDIUM**: ${slowResponses} responses took over 48 hours`);
    }

    if (problems.length === 0) {
      problems.push('✅ No critical issues identified');
    }

    problems.forEach(problem => report.push(`- ${problem}`));
    report.push('\n');

    // ========================================
    // RECOMMENDATIONS
    // ========================================
    report.push('## SYSTEM DESIGN RECOMMENDATIONS\n');

    report.push('### 1. Automated Email Categorization\n');
    report.push('**Implement automatic email categorization on ingestion:**\n');
    report.push('- Etsy sales → Auto-create work item with source="etsy"');
    report.push('- Shopify orders → Auto-create work item with source="shopify"');
    report.push('- Subject contains "custom" + inbound → Flag as custom order inquiry');
    report.push('- Subject contains "design", "proof", "approval" → Flag as design review');
    report.push('- From known spam/marketing domains → Auto-archive');
    report.push('- All other inbound → Mark for manual triage\n');

    report.push('### 2. Automatic Work Item Creation\n');
    report.push('**Auto-create work items for:**\n');
    report.push('- Etsy sales (parse order details from email)');
    report.push('- Shopify customer messages (create assisted_project)');
    report.push('- First-time customer inquiries (create lead/inquiry work item)');
    report.push('- Thread emails to existing work items based on subject/participants\n');

    report.push('### 3. Email Threading & Linking\n');
    report.push('**Improve thread management:**\n');
    report.push('- Use provider_thread_id to automatically link all emails in a conversation to the same work item');
    report.push('- When creating work item from email, link all previous emails in thread');
    report.push('- Show full email thread timeline in work item detail view\n');

    report.push('### 4. Triage Queue Improvements\n');
    report.push('**Build a smarter triage system:**\n');
    report.push('- Separate queues: "Needs Work Item", "Needs Response", "Design Review", "FYI Only"');
    report.push('- Priority scoring based on: customer history, response time, thread length');
    report.push('- Bulk actions: archive spam, create work items, assign to team members');
    report.push('- Smart filters by category, has attachments, response time\n');

    report.push('### 5. Response Time Tracking\n');
    report.push('**Add SLA monitoring:**\n');
    report.push('- Set target response times (e.g., 24 hours for customer inquiries)');
    report.push('- Alert when emails approach SLA deadline');
    report.push('- Dashboard showing response time metrics by category');
    report.push('- Flag slow-to-respond threads for escalation\n');

    report.push('### 6. Customer Context\n');
    report.push('**Enrich customer data:**\n');
    report.push('- Link emails to customer records automatically');
    report.push('- Show customer history: all work items, all emails, total revenue');
    report.push('- Identify VIP customers (high email volume or high order value)');
    report.push('- Tag customers with special notes/flags\n');

    report.push('### 7. Template & Automation Opportunities\n');
    report.push('**Based on common patterns, create:**\n');
    report.push('- Quick reply templates for common questions (lead times, customization options, pricing)');
    report.push('- Auto-responses for received inquiries ("Thanks, we\'ll respond within 24 hours")');
    report.push('- Follow-up automation (if no response in X days, send gentle reminder)');
    report.push('- Design approval reminders\n');

    report.push('### 8. Spam/Noise Filtering\n');
    report.push('**Reduce noise:**\n');
    report.push(`- Auto-archive: ${categories['Spam/Irrelevant'].length} emails identified as spam/irrelevant`);
    report.push('- Blacklist domains: substack.com, ringcentral.com, tiktok notifications, etc.');
    report.push('- Whitelist customer domains to ensure real inquiries never missed');
    report.push('- Manual spam reporting to improve filters\n');

    // ========================================
    // ACTION ITEMS
    // ========================================
    report.push('## IMMEDIATE ACTION ITEMS\n');

    report.push(`1. **Triage ${untriaged.length} untriaged emails** - Start with customer inquiries first`);
    report.push(`2. **Link ${customerInquiriesNoWorkItem.length} customer inquiries to work items** - These are likely lost leads`);
    report.push(`3. **Archive ${categories['Spam/Irrelevant'].length} spam/irrelevant emails** - Clean up the noise`);
    report.push(`4. **Auto-create work items for ${categories['Etsy Sales'].length} Etsy sales** - Should have been automatic`);
    report.push(`5. **Auto-create work items for ${categories['Shopify Orders'].length} Shopify messages** - Customer service inquiries`);
    report.push('6. **Implement email categorization rules** - Prevent future backlog');
    report.push('7. **Set up triage queue dashboard** - Make it easy to process emails daily');
    report.push('8. **Create response templates** - Speed up common responses\n');

    // ========================================
    // METRICS TO TRACK
    // ========================================
    report.push('## KEY METRICS TO TRACK GOING FORWARD\n');

    report.push('**Daily Metrics:**');
    report.push('- New emails received (by category)');
    report.push('- Emails triaged');
    report.push('- Emails still untriaged');
    report.push('- Average response time');
    report.push('- Emails linked to work items\n');

    report.push('**Weekly Metrics:**');
    report.push('- Response time by category');
    report.push('- Customer satisfaction (from resolved threads)');
    report.push('- Conversion rate (inquiry → work item → order)');
    report.push('- Most active customers');
    report.push('- Email volume trends\n');

    report.push('**Monthly Metrics:**');
    report.push('- Total email volume');
    report.push('- Category breakdown trends');
    report.push('- SLA compliance rate');
    report.push('- Automation success rate');
    report.push('- Team response time trends\n');

    // Write report to file
    const reportContent = report.join('\n');
    fs.writeFileSync('EMAIL_SYSTEM_REPORT.md', reportContent);

    console.log(reportContent);
    console.log('\n\n---');
    console.log('✅ Report saved to EMAIL_SYSTEM_REPORT.md');

  } catch (err) {
    console.error('Error:', err);
    process.exit(1);
  }
})();
