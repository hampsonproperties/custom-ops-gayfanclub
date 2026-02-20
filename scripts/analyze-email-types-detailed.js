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

    report.push('# DETAILED EMAIL TYPES & CONTENT ANALYSIS');
    report.push(`Generated: ${new Date().toLocaleString()}`);
    report.push('\n---\n');

    // ========================================
    // CUSTOMER INQUIRY TYPES
    // ========================================
    report.push('## CUSTOMER INQUIRY TYPES (Detailed Breakdown)\n');

    const inquiryTypes = {
      'Custom Order Quote Request': [],
      'Lead Time / Timeline Questions': [],
      'Design / Mockup Questions': [],
      'Product Specifications': [],
      'Bulk/Wholesale Pricing': [],
      'Sample Requests': [],
      'Color / Material Questions': [],
      'Shipping / Delivery Questions': [],
      'General Information': [],
      'Follow-up on Previous Order': [],
      'Order Status Check': [],
      'Other': []
    };

    const customerEmails = communications.filter(email => {
      const from = email.from_email.toLowerCase();
      return email.direction === 'inbound' &&
             !from.includes('shopify.com') &&
             !from.includes('etsy.com') &&
             !from.includes('noreply') &&
             !from.includes('notification') &&
             !from.includes('substack') &&
             !from.includes('ringcentral') &&
             !from.includes('tiktok') &&
             from !== 'sales@thegayfanclub.com';
    });

    customerEmails.forEach(email => {
      const subject = (email.subject || '').toLowerCase();
      const preview = (email.body_preview || '').toLowerCase();
      const combined = subject + ' ' + preview;

      if (combined.includes('quote') || combined.includes('pricing') || combined.includes('cost') || combined.includes('how much')) {
        inquiryTypes['Custom Order Quote Request'].push(email);
      } else if (combined.includes('lead time') || combined.includes('timeline') || combined.includes('how long') || combined.includes('when can') || combined.includes('turnaround')) {
        inquiryTypes['Lead Time / Timeline Questions'].push(email);
      } else if (combined.includes('design') || combined.includes('mockup') || combined.includes('proof') || combined.includes('artwork')) {
        inquiryTypes['Design / Mockup Questions'].push(email);
      } else if (combined.includes('sample') || combined.includes('test order')) {
        inquiryTypes['Sample Requests'].push(email);
      } else if (combined.includes('bulk') || combined.includes('wholesale') || combined.includes('100') || combined.includes('quantity')) {
        inquiryTypes['Bulk/Wholesale Pricing'].push(email);
      } else if (combined.includes('color') || combined.includes('material') || combined.includes('uv') || combined.includes('size')) {
        inquiryTypes['Color / Material Questions'].push(email);
      } else if (combined.includes('shipping') || combined.includes('delivery') || combined.includes('tracking')) {
        inquiryTypes['Shipping / Delivery Questions'].push(email);
      } else if (combined.includes('order') && (combined.includes('status') || combined.includes('where is') || combined.includes('update'))) {
        inquiryTypes['Order Status Check'].push(email);
      } else if (combined.includes('spec') || combined.includes('dimension') || combined.includes('measurement')) {
        inquiryTypes['Product Specifications'].push(email);
      } else if (combined.includes('re:') || combined.includes('fw:') || combined.includes('following up')) {
        inquiryTypes['Follow-up on Previous Order'].push(email);
      } else if (combined.includes('custom fan') || combined.includes('inquiry') || combined.includes('interested')) {
        inquiryTypes['General Information'].push(email);
      } else {
        inquiryTypes['Other'].push(email);
      }
    });

    // Sort by frequency
    const sortedInquiryTypes = Object.entries(inquiryTypes)
      .sort((a, b) => b[1].length - a[1].length);

    sortedInquiryTypes.forEach(([type, emails]) => {
      if (emails.length === 0) return;

      const percent = ((emails.length / customerEmails.length) * 100).toFixed(1);
      report.push(`### ${type}: ${emails.length} emails (${percent}%)\n`);

      // Show real examples
      report.push('**Real Examples:**\n');
      emails.slice(0, 5).forEach((email, i) => {
        report.push(`${i + 1}. **From:** ${email.from_email}`);
        report.push(`   **Subject:** ${email.subject || '(no subject)'}`);
        if (email.body_preview) {
          report.push(`   **Preview:** ${email.body_preview.substring(0, 250)}...`);
        }
        report.push('');
      });
      report.push('');
    });

    // ========================================
    // DESIGN REVIEW STAGES
    // ========================================
    report.push('\n## DESIGN REVIEW & APPROVAL WORKFLOW\n');

    const designEmails = communications.filter(email => {
      const subject = (email.subject || '').toLowerCase();
      const preview = (email.body_preview || '').toLowerCase();
      return subject.includes('design') || subject.includes('proof') ||
             subject.includes('approval') || subject.includes('mockup') ||
             preview.includes('design') || preview.includes('proof');
    });

    const designStages = {
      'Initial Design Request': [],
      'Design Fee Payment': [],
      'First Proof Sent': [],
      'Revision Requested': [],
      'Design Approved': [],
      'Design Rejected/Needs Major Changes': [],
      'Follow-up on Pending Approval': []
    };

    designEmails.forEach(email => {
      const subject = (email.subject || '').toLowerCase();
      const preview = (email.body_preview || '').toLowerCase();
      const combined = subject + ' ' + preview;

      if (combined.includes('design fee') || combined.includes('$35')) {
        designStages['Design Fee Payment'].push(email);
      } else if (combined.includes('approved') || combined.includes('looks good') || combined.includes('perfect')) {
        designStages['Design Approved'].push(email);
      } else if (combined.includes('revision') || combined.includes('change') || combined.includes('update')) {
        designStages['Revision Requested'].push(email);
      } else if (combined.includes('following up') || combined.includes('reminder')) {
        designStages['Follow-up on Pending Approval'].push(email);
      } else if (combined.includes('your custom fan order') && combined.includes('approved')) {
        designStages['First Proof Sent'].push(email);
      } else if (combined.includes('not what') || combined.includes('wrong') || combined.includes('redo')) {
        designStages['Design Rejected/Needs Major Changes'].push(email);
      } else {
        designStages['Initial Design Request'].push(email);
      }
    });

    report.push(`**Total Design-Related Emails:** ${designEmails.length}\n`);

    Object.entries(designStages).forEach(([stage, emails]) => {
      if (emails.length === 0) return;
      report.push(`### ${stage}: ${emails.length} emails`);

      // Show examples
      if (emails.length > 0) {
        report.push('**Examples:**');
        emails.slice(0, 3).forEach(email => {
          report.push(`- "${email.subject || '(no subject)'}"`);
        });
      }
      report.push('');
    });

    // ========================================
    // SUPPORT ISSUES
    // ========================================
    report.push('\n## CUSTOMER SUPPORT ISSUES\n');

    const supportIssues = {
      'Missing/Lost Items': [],
      'Wrong Item Received': [],
      'Damaged Item': [],
      'Delivery Delay': [],
      'Order Cancellation Request': [],
      'Refund Request': [],
      'Product Quality Complaint': [],
      'Other Support': []
    };

    const supportEmails = communications.filter(email => {
      const subject = (email.subject || '').toLowerCase();
      const preview = (email.body_preview || '').toLowerCase();
      const combined = subject + ' ' + preview;

      return email.direction === 'inbound' &&
             (combined.includes('issue') || combined.includes('problem') ||
              combined.includes('missing') || combined.includes('wrong') ||
              combined.includes('damage') || combined.includes('complaint') ||
              combined.includes('refund') || combined.includes('cancel'));
    });

    supportEmails.forEach(email => {
      const subject = (email.subject || '').toLowerCase();
      const preview = (email.body_preview || '').toLowerCase();
      const combined = subject + ' ' + preview;

      if (combined.includes('missing') || combined.includes('lost') || combined.includes('not receive')) {
        supportIssues['Missing/Lost Items'].push(email);
      } else if (combined.includes('wrong') || combined.includes('incorrect')) {
        supportIssues['Wrong Item Received'].push(email);
      } else if (combined.includes('damage') || combined.includes('broken')) {
        supportIssues['Damaged Item'].push(email);
      } else if (combined.includes('delay') || combined.includes('late') || combined.includes('still waiting')) {
        supportIssues['Delivery Delay'].push(email);
      } else if (combined.includes('cancel')) {
        supportIssues['Order Cancellation Request'].push(email);
      } else if (combined.includes('refund')) {
        supportIssues['Refund Request'].push(email);
      } else if (combined.includes('quality') || combined.includes('defect')) {
        supportIssues['Product Quality Complaint'].push(email);
      } else {
        supportIssues['Other Support'].push(email);
      }
    });

    report.push(`**Total Support Issue Emails:** ${supportEmails.length}\n`);

    Object.entries(supportIssues).forEach(([issue, emails]) => {
      if (emails.length === 0) return;
      report.push(`### ${issue}: ${emails.length} emails`);

      if (emails.length > 0) {
        report.push('**Examples:**');
        emails.slice(0, 3).forEach(email => {
          report.push(`- From: ${email.from_email}`);
          report.push(`  "${email.subject || '(no subject)'}"`);
          if (email.body_preview) {
            report.push(`  Preview: ${email.body_preview.substring(0, 150)}...`);
          }
        });
      }
      report.push('');
    });

    // ========================================
    // B2B/WHOLESALE COMMUNICATIONS
    // ========================================
    report.push('\n## B2B / WHOLESALE / CORPORATE ORDERS\n');

    const b2bEmails = communications.filter(email => {
      const from = email.from_email.toLowerCase();
      const subject = (email.subject || '').toLowerCase();
      const preview = (email.body_preview || '').toLowerCase();
      const combined = subject + ' ' + preview;

      return from.includes('loreal') ||
             from.includes('ritz') ||
             combined.includes('vendor') ||
             combined.includes('wholesale') ||
             combined.includes('corporate') ||
             combined.includes('event') ||
             combined.includes('wedding') ||
             combined.includes('1099') ||
             combined.includes('tax') ||
             (email.direction === 'inbound' && (
               combined.includes('500') || combined.includes('1000') ||
               combined.includes('bulk order')
             ));
    });

    const b2bTypes = {
      'Large Corporate Order (L\'Oreal, etc)': [],
      'Wedding/Event Orders': [],
      'Vendor Documentation': [],
      'Wholesale Partnership': [],
      'Other B2B': []
    };

    b2bEmails.forEach(email => {
      const from = email.from_email.toLowerCase();
      const subject = (email.subject || '').toLowerCase();
      const preview = (email.body_preview || '').toLowerCase();
      const combined = subject + ' ' + preview;

      if (from.includes('loreal') || from.includes('ritz')) {
        b2bTypes['Large Corporate Order (L\'Oreal, etc)'].push(email);
      } else if (combined.includes('wedding') || combined.includes('event')) {
        b2bTypes['Wedding/Event Orders'].push(email);
      } else if (combined.includes('vendor') || combined.includes('1099') || combined.includes('tax')) {
        b2bTypes['Vendor Documentation'].push(email);
      } else if (combined.includes('wholesale') || combined.includes('partnership')) {
        b2bTypes['Wholesale Partnership'].push(email);
      } else {
        b2bTypes['Other B2B'].push(email);
      }
    });

    report.push(`**Total B2B Emails:** ${b2bEmails.length}\n`);

    Object.entries(b2bTypes).forEach(([type, emails]) => {
      if (emails.length === 0) return;
      report.push(`### ${type}: ${emails.length} emails`);

      if (emails.length > 0) {
        report.push('**Examples:**');
        emails.slice(0, 3).forEach(email => {
          report.push(`- From: ${email.from_email}`);
          report.push(`  Subject: ${email.subject || '(no subject)'}`);
        });
      }
      report.push('');
    });

    // ========================================
    // SHOPIFY & ETSY PATTERNS
    // ========================================
    report.push('\n## SHOPIFY & ETSY EMAIL PATTERNS\n');

    const shopifyEmails = communications.filter(e => e.from_email.toLowerCase().includes('shopify'));
    const etsyEmails = communications.filter(e => e.from_email.toLowerCase().includes('etsy'));

    report.push('### Shopify Emails\n');
    const shopifyTypes = {};
    shopifyEmails.forEach(email => {
      const subject = email.subject || '(no subject)';

      let type = 'Other';
      if (subject.includes('customer message')) type = 'Customer Message';
      else if (subject.includes('order')) type = 'Order Notification';
      else if (subject.includes('Terms')) type = 'Platform Updates';

      shopifyTypes[type] = (shopifyTypes[type] || 0) + 1;
    });

    Object.entries(shopifyTypes).forEach(([type, count]) => {
      report.push(`- ${type}: ${count} emails`);
    });
    report.push('');

    report.push('### Etsy Emails\n');
    const etsyTypes = {};
    etsyEmails.forEach(email => {
      const subject = email.subject || '(no subject)';

      let type = 'Other';
      if (subject.includes('sale')) type = 'Sale Notification';
      else if (subject.includes('message')) type = 'Customer Message';
      else if (subject.includes('review')) type = 'Review Request';

      etsyTypes[type] = (etsyTypes[type] || 0) + 1;
    });

    Object.entries(etsyTypes).forEach(([type, count]) => {
      report.push(`- ${type}: ${count} emails`);
    });
    report.push('');

    // ========================================
    // COMMON SUBJECT LINES
    // ========================================
    report.push('\n## MOST COMMON SUBJECT LINES\n');

    const subjectCounts = {};
    communications.forEach(email => {
      const subject = email.subject || '(no subject)';
      subjectCounts[subject] = (subjectCounts[subject] || 0) + 1;
    });

    const topSubjects = Object.entries(subjectCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 30);

    report.push('**Top 30 Most Repeated Subject Lines:**\n');
    topSubjects.forEach(([subject, count], i) => {
      report.push(`${i + 1}. "${subject}" - ${count} times`);
    });
    report.push('\n');

    // ========================================
    // COMMON QUESTIONS/TOPICS
    // ========================================
    report.push('\n## FREQUENTLY ASKED QUESTIONS (From Email Content)\n');

    const topics = {
      'Lead time / Timeline': 0,
      'Pricing / Cost': 0,
      'Customization options': 0,
      'Design process': 0,
      'Sample availability': 0,
      'Bulk/wholesale pricing': 0,
      'Shipping options': 0,
      'Color options': 0,
      'Size/dimensions': 0,
      'UV reactive': 0,
      'Material questions': 0,
      'Order tracking': 0,
      'Design approval': 0
    };

    communications.forEach(email => {
      const combined = ((email.subject || '') + ' ' + (email.body_preview || '')).toLowerCase();

      if (combined.includes('lead time') || combined.includes('how long') || combined.includes('timeline') || combined.includes('turnaround')) {
        topics['Lead time / Timeline']++;
      }
      if (combined.includes('price') || combined.includes('cost') || combined.includes('how much')) {
        topics['Pricing / Cost']++;
      }
      if (combined.includes('custom') || combined.includes('personalize')) {
        topics['Customization options']++;
      }
      if (combined.includes('design') || combined.includes('mockup')) {
        topics['Design process']++;
      }
      if (combined.includes('sample')) {
        topics['Sample availability']++;
      }
      if (combined.includes('bulk') || combined.includes('wholesale')) {
        topics['Bulk/wholesale pricing']++;
      }
      if (combined.includes('shipping') || combined.includes('delivery')) {
        topics['Shipping options']++;
      }
      if (combined.includes('color')) {
        topics['Color options']++;
      }
      if (combined.includes('size') || combined.includes('dimension')) {
        topics['Size/dimensions']++;
      }
      if (combined.includes('uv')) {
        topics['UV reactive']++;
      }
      if (combined.includes('material')) {
        topics['Material questions']++;
      }
      if (combined.includes('tracking') || combined.includes('where is')) {
        topics['Order tracking']++;
      }
      if (combined.includes('approval') || combined.includes('approve')) {
        topics['Design approval']++;
      }
    });

    Object.entries(topics)
      .sort((a, b) => b[1] - a[1])
      .forEach(([topic, count]) => {
        if (count > 0) {
          report.push(`- **${topic}**: Mentioned in ${count} emails`);
        }
      });
    report.push('\n');

    // ========================================
    // EMAIL JOURNEY STAGES
    // ========================================
    report.push('\n## CUSTOMER JOURNEY STAGES (Based on Email Content)\n');

    const journeyStages = {
      'Stage 1: Initial Inquiry': [],
      'Stage 2: Quote/Pricing Discussion': [],
      'Stage 3: Design Fee & Order Placement': [],
      'Stage 4: Design Review & Approval': [],
      'Stage 5: Production & Updates': [],
      'Stage 6: Shipping & Delivery': [],
      'Stage 7: Post-Purchase Follow-up': []
    };

    communications.forEach(email => {
      const subject = (email.subject || '').toLowerCase();
      const preview = (email.body_preview || '').toLowerCase();
      const combined = subject + ' ' + preview;

      if (combined.includes('inquiry') || combined.includes('interested in') || combined.includes('hello') && email.direction === 'inbound') {
        journeyStages['Stage 1: Initial Inquiry'].push(email);
      } else if (combined.includes('quote') || combined.includes('pricing') || combined.includes('how much')) {
        journeyStages['Stage 2: Quote/Pricing Discussion'].push(email);
      } else if (combined.includes('design fee') || combined.includes('order placed') || combined.includes('payment')) {
        journeyStages['Stage 3: Design Fee & Order Placement'].push(email);
      } else if (combined.includes('proof') || combined.includes('mockup') || combined.includes('design') || combined.includes('approval')) {
        journeyStages['Stage 4: Design Review & Approval'].push(email);
      } else if (combined.includes('production') || combined.includes('batch') || combined.includes('printing')) {
        journeyStages['Stage 5: Production & Updates'].push(email);
      } else if (combined.includes('shipping') || combined.includes('tracking') || combined.includes('shipped')) {
        journeyStages['Stage 6: Shipping & Delivery'].push(email);
      } else if (combined.includes('received') || combined.includes('thank you') || combined.includes('review')) {
        journeyStages['Stage 7: Post-Purchase Follow-up'].push(email);
      }
    });

    Object.entries(journeyStages).forEach(([stage, emails]) => {
      const percent = emails.length > 0 ? ((emails.length / communications.length) * 100).toFixed(1) : 0;
      report.push(`### ${stage}: ${emails.length} emails (${percent}%)`);
      report.push('');
    });

    // ========================================
    // SYSTEM DESIGN INSIGHTS
    // ========================================
    report.push('\n## SYSTEM DESIGN INSIGHTS FROM EMAIL PATTERNS\n');

    report.push('### Email Types That MUST Auto-Create Work Items:\n');
    report.push('1. **Etsy Sales** - Every sale = new work item');
    report.push('2. **Shopify Customer Messages** - Every inquiry = new assisted project');
    report.push('3. **Initial Custom Inquiries** - First email from new customer = lead/inquiry');
    report.push('4. **B2B Corporate Orders** - High value, needs tracking');
    report.push('5. **Support Issues** - Missing items, damages, etc.\n');

    report.push('### Email Types That Should Auto-Link to Existing Work Items:\n');
    report.push('1. **Design Approvals** - Link to existing order via thread_id or subject');
    report.push('2. **Follow-ups in Thread** - Use provider_thread_id to link');
    report.push('3. **Order Status Checks** - Match to work item via order number in subject');
    report.push('4. **Revision Requests** - Link to design in progress\n');

    report.push('### Email Types That Can Auto-Archive:\n');
    report.push('1. **Marketing/Newsletter** - Substack, print shop promos, etc.');
    report.push('2. **Social Media Notifications** - TikTok, Instagram');
    report.push('3. **RingCentral Notifications** - Phone system alerts');
    report.push('4. **Platform Updates** - Shopify/Etsy policy changes\n');

    report.push('### Priority Queue System Needed:\n');
    report.push('**HIGH PRIORITY:**');
    report.push('- Support issues (missing/damaged items)');
    report.push('- Design approvals pending');
    report.push('- Customer waiting for response (>24 hours)\n');

    report.push('**MEDIUM PRIORITY:**');
    report.push('- New inquiries');
    report.push('- Quote requests');
    report.push('- Order status checks\n');

    report.push('**LOW PRIORITY:**');
    report.push('- General information requests');
    report.push('- Follow-ups on pending items');
    report.push('- FYI emails\n');

    report.push('### Templates Needed (Based on Common Questions):\n');
    const templateTopics = Object.entries(topics).sort((a, b) => b[1] - a[1]).slice(0, 10);
    templateTopics.forEach(([topic, count], i) => {
      report.push(`${i + 1}. Template for "${topic}" - Used ${count} times`);
    });
    report.push('\n');

    // Write to file
    const reportContent = report.join('\n');
    fs.writeFileSync('EMAIL_TYPES_DETAILED_REPORT.md', reportContent);

    console.log(reportContent);
    console.log('\n\n---');
    console.log('✅ Detailed report saved to EMAIL_TYPES_DETAILED_REPORT.md');

  } catch (err) {
    console.error('Error:', err);
    process.exit(1);
  }
})();
