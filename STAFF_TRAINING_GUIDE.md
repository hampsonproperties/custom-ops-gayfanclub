# 📚 Staff Training Guide - Custom Ops Platform

**Welcome to your upgraded operations platform!** This guide will show you how to use all the new features to work more efficiently.

---

## 🎯 Quick Start: What's New for You

Your daily workflow just got easier with these new tools:

1. **Dashboard shows what needs your attention** - No more guessing what to work on
2. **Stuck items are automatically detected** - Critical issues surface immediately
3. **Emails are automatically organized** - Less time sorting, more time working
4. **Customer profiles show full history** - Complete context in one place
5. **Quick reply templates** - 1-click responses to common questions

---

## 🏠 Your New Dashboard

**Location**: Go to `/dashboard` (homepage after login)

### What You'll See

#### 1. "My Actions Today" Widget

This is your personalized to-do list that refreshes every 2 minutes:

**What it shows**:
- 🔴 **Urgent follow-ups** - Work items that need follow-up TODAY
- 📧 **Untriaged emails** - New emails waiting to be sorted
- ⏰ **Expiring approvals** - Customer approvals expiring in next 3 days
- 💰 **Overdue payments** - Invoices unpaid for 7+ days
- 📄 **Missing files** - Customers who need to send files

**How to use it**:
1. Start your day by checking this widget
2. Click any item to jump directly to it
3. Work through items from top to bottom (sorted by priority)
4. Widget auto-refreshes - no need to reload page

---

#### 2. "Stuck Items" Card

Shows work items that need immediate attention:

**What counts as "stuck"**:
- ⏳ **Expired Approvals** (14+ days) - Approval links have expired, need manual follow-up
- 💸 **Overdue Invoices** (30+ days) - Payment significantly overdue
- 📎 **Awaiting Files** (7+ days) - Customer hasn't sent promised files
- 🎨 **Design Review Pending** (7+ days) - Design sitting in queue, not reviewed
- 📅 **No Follow-up Scheduled** - Item has no next action date
- ⚠️ **Failed Operations** - Something went wrong and needs manual fix

**How to use it**:
1. Check this daily (usually first thing in morning)
2. Red border = urgent items need attention
3. Click "View All Stuck Items" to see details
4. Prioritize items with highest priority score

**Example**:
```
Stuck Items: 12
- 3 Expired Approvals (Priority 3 - High)
- 2 Overdue Invoices (Priority 2 - Medium)
- 7 Awaiting Files (Priority 2 - Medium)
```

---

## 📧 Email Management

### How Emails Are Now Organized

Emails automatically categorize into:

- **Primary** - Customer inquiries, form submissions, enterprise clients (L'Oreal, Luxottica, etc.)
- **Other** - Shopify notifications, automated emails, no-reply senders
- **Spam** - Marketing emails, known spam domains

**What this means for you**:
- Start with "Primary" inbox - these are real customers
- Check "Other" for order updates (but less urgent)
- Ignore "Spam" (system blocks these automatically)

---

### Email Intake Page

**Location**: `/email-intake`

#### New Features

**1. Auto-Linking**

Emails automatically link to work items using 5 strategies:
- Email thread matching (Re: CLACK FAN DESIGN)
- Order number extraction (Order #1234, Ref: 1234)
- Customer email matching (recent orders from this customer)
- Work item title matching (keywords in subject)
- Subject matching (similar subjects)

**What you do**: Just verify the system linked it correctly. If wrong, manually change it.

**2. Smart Categorization**

System automatically assigns category based on:
- **Domain filters** (L'Oreal always goes to "Primary")
- **Subject keywords** ("missing items" → "Support")
- **Form providers** (PowerfulForm always goes to "Primary")

**What you do**: Check if category looks right. Change if needed.

**3. Conversation Threading**

Emails from same thread (e.g., "Re: CLACK FAN DESIGN") are grouped:
- See full conversation history
- All 13 back-and-forth messages in one place
- Understand context without searching

**What you do**: Click "View Conversation" to see full thread.

---

### Quick Reply Templates (Coming Soon - UI Not Built Yet)

**For now, templates are in database. Manual access via SQL**:

```sql
SELECT key, name, body_html_template
FROM quick_reply_templates
WHERE is_active = TRUE;
```

**Available Templates** (keyboard shortcuts):

1. **Customization Options** (Shortcut: 1)
   - What: Explains custom text, colors, fonts, positioning options
   - When: Customer asks "Can you customize this?"

2. **Shipping Timeline** (Shortcut: 2)
   - What: Design approval (1-2 days), production (7-10 days), shipping (3-5 days)
   - When: Customer asks "When will I receive this?"

3. **File Requirements** (Shortcut: 3)
   - What: File formats (AI, EPS, PDF, PNG), minimum 300 DPI, etc.
   - When: Customer asks "What files do you need?"

4. **Design Changes** (Shortcut: 4)
   - What: Acknowledges revision request, promises updated proof in 1-2 days
   - When: Customer requests design changes

5. **Payment Terms** (Shortcut: 5)
   - What: 50% deposit, 50% balance, payment methods
   - When: Customer asks about payment

6. **Bulk Discounts** (Shortcut: 6)
   - What: 10% off 100-249, 15% off 250-499, 20% off 500+
   - When: Customer asks about volume pricing

7. **Missing Items Support**
   - What: Apology, asks for photos/details, promises rush replacement
   - When: Customer reports missing items

8. **Damaged Items Support**
   - What: Apology, asks for photos, promises rush replacement, no return needed
   - When: Customer reports damaged items

**How to use (manual for now)**:
1. Look up template in database
2. Copy body_html_template
3. Replace {{customer_name}}, {{work_item_title}}, etc. with real values
4. Send email

---

## 👤 Customer Profiles

**Location**: `/customers/[customer-id]`

**How to get there**:
- Click customer name from work item page
- Click customer email from email intake
- Search for customer in navigation

### What You'll See

**1. Customer Overview**
- Name, email, phone
- Display name (how they prefer to be addressed)
- Total number of projects
- Total communications (emails)

**2. Work Items (Projects)**

All projects from this customer:
- Current status (New Inquiry, In Progress, Shipped, etc.)
- Order numbers (Shopify #1234)
- Event dates (for time-sensitive projects)
- Creation date (when they first contacted us)

**Example**:
```
Matthew Curtis
Email: matthew.curtis@loreal.com
Phone: (555) 123-4567

Work Items (3):
1. Custom Pride Fans - 500 units (Status: In Production)
   Shopify #6789, Event: June 15, 2026

2. Sample Order - 50 units (Status: Shipped)
   Shopify #6540, Delivered: Feb 10, 2026

3. Initial Inquiry (Status: Closed)
   Created: Jan 28, 2026
```

**3. Conversations (Email Threads)**

All email threads with this customer:
- Subject lines
- Message count (how many back-and-forth messages)
- Last message date
- Unread status

**Example**:
```
Conversations (2):
1. "Re: CLACK FAN DESIGN - Final Proof" (13 messages)
   Last message: Feb 18, 2026 (2 hours ago) - Unread

2. "Sample Order Confirmation" (4 messages)
   Last message: Feb 10, 2026 - Read
```

**Why this matters**:
- See if customer is a repeat buyer
- Understand their history before calling
- VIP treatment for enterprise customers (L'Oreal, Luxottica)
- Avoid asking questions they already answered

---

## 🚨 Stuck Items Page

**Location**: `/stuck-items`

This is your **daily priority list** of items that need attention.

### How Items Get "Stuck"

**1. Expired Approvals** (Priority: High - 3)
- Customer approval link sent 14+ days ago
- Link has expired (tokens only valid 14 days)
- **Action needed**: Regenerate approval link, send new email

**2. Overdue Invoices** (Priority: Medium-High - 2)
- Deposit paid 30+ days ago
- Balance still not paid
- **Action needed**: Send payment reminder, call customer if >45 days

**3. Awaiting Files** (Priority: Medium-High - 2)
- Requested customer files 7+ days ago
- Still haven't received them
- **Action needed**: Send reminder email, call if urgent project

**4. Design Review Pending** (Priority: Medium - 2)
- Design submitted 7+ days ago
- Team hasn't reviewed it yet
- **Action needed**: Review design, send proof or request changes

**5. No Follow-up Scheduled** (Priority: Low - 1)
- Work item has no next action date
- Could fall through cracks
- **Action needed**: Set next follow-up date

**6. Stale Items** (Priority: Low - 1)
- No activity for 14+ days
- Might be abandoned
- **Action needed**: Check if still active, close if abandoned

**7. Failed Operations** (Priority: Varies)
- File download failed
- Email import error
- System couldn't complete operation
- **Action needed**: Check error message, retry manually

### How to Use Stuck Items Page

**Daily Routine** (recommended):

1. **Morning (9am)**:
   - Open `/stuck-items`
   - Sort by priority (highest first)
   - Work through High priority items (Priority 3)
   - Set goal to clear all Priority 3 by lunch

2. **Afternoon (2pm)**:
   - Check for new stuck items
   - Work through Medium priority (Priority 2)
   - Update follow-up dates

3. **End of day (5pm)**:
   - Quick check for any new urgent items
   - Make notes for tomorrow if anything pending

**Table View**:

| Work Item | Customer | Status | Days Waiting | Stuck Reason | Priority | Actions |
|-----------|----------|--------|--------------|--------------|----------|---------|
| Pride Fans 500 units | Matthew Curtis | Awaiting Approval | 16 days | Expired Approval | 3 | Regenerate Link |
| Logo Design | Sarah Smith | Deposit Paid | 35 days | Overdue Invoice | 2 | Send Reminder |

**Filtering**:
- Filter by priority (High, Medium, Low)
- Filter by stuck reason
- Filter by customer
- Search by work item title

---

## 🔔 Reminders (Automated)

**Good news**: You don't manually send these anymore! System handles it automatically.

### How Reminders Work

**System checks daily** for these conditions:

**1. Approval Expiring (2 days before)**
- When: Customer has approval link that expires in 2 days
- System: Automatically sends reminder email
- You: Check if customer responded after reminder

**2. Payment Overdue (7 days after deposit)**
- When: Deposit paid but balance not paid after 7 days
- System: Sends reminder to customer AND notifies you
- You: Follow up with phone call if >14 days

**3. Files Not Received (7 days after request)**
- When: Customer promised files but didn't send after 7 days
- System: Sends gentle reminder email
- You: Call customer if urgent project

**4. Design Review Pending (3 days idle - Internal)**
- When: Design sitting in queue for 3 days
- System: Alerts you (not customer)
- You: Prioritize reviewing this design

### Checking Reminder Status

**To see upcoming reminders** (SQL query):
```sql
SELECT * FROM reminder_stats;
```

**To see reminder history**:
Go to work item page → "History" tab → Filter for "Reminder Sent"

---

## 🛠️ Troubleshooting

### "Why isn't this email linking to the right order?"

**Possible causes**:
1. **Customer used different email** - Check if they have alternate emails
2. **Order number not in subject/body** - Manually link it
3. **New customer** - System has no history to match against

**How to fix**:
1. Go to email in Email Intake
2. Click "Link to Work Item" dropdown
3. Search for correct work item
4. Select it manually
5. System learns from your choice

---

### "Stuck item shows expired approval but I just sent new link"

**Why this happens**:
- Dashboard refreshes every 5 minutes
- Database updates every 2 minutes
- Takes a few minutes to reflect

**How to fix**:
1. Mark work item status as "Awaiting Approval"
2. Update "last_contact_at" to today
3. Stuck item will disappear on next refresh

---

### "Customer emails going to 'Other' but should be 'Primary'"

**How to fix**:
1. Note their email domain (e.g., @newcustomer.com)
2. Ask admin to add email filter:
   ```sql
   INSERT INTO email_filters (filter_type, pattern, action, target_category, name, priority)
   VALUES ('domain', '@newcustomer.com', 'categorize', 'primary', 'New Customer Emails', 5);
   ```
3. Future emails from this domain automatically go to Primary

---

### "Dead Letter Queue has failed items - what do I do?"

**What it means**: System tried to do something (download file, import email) but failed. It will automatically retry.

**Retry schedule**:
- 1st retry: 5 minutes later
- 2nd retry: 15 minutes later
- 3rd retry: 45 minutes later
- 4th retry: 2 hours later
- 5th retry: 6 hours later

**When to take action**:
- If retry count = 5 (max retries exceeded)
- If status = "failed"

**How to check**:
```sql
SELECT operation_type, error_message, retry_count, status
FROM dead_letter_queue
WHERE status IN ('failed', 'pending')
ORDER BY created_at DESC;
```

**How to fix**:
1. Read error message
2. If file download failed: Check if URL is still valid
3. If email import failed: Check Microsoft Graph API connection
4. Ask admin for help if unclear

---

## 📊 Reports & Analytics

### Email Health Report

**Check this weekly**:
```sql
SELECT * FROM email_import_health;
```

**What to look for**:
- `total_emails` - Should increase steadily
- `missing_both_ids` - Should be 0 (means duplicates possible)
- `emails_last_24h` - Typical volume (~50-100 per day)
- `untriaged_count` - Should be <20 (clear inbox daily)

---

### Stuck Items Summary

**Check this daily**:
```sql
SELECT * FROM stuck_items_summary;
```

**What you'll see**:
```
stuck_type               | count | avg_days_waiting
-------------------------|-------|------------------
expired_approvals        |   3   | 18.5
overdue_invoices         |   2   | 42.0
awaiting_files           |   7   | 9.3
design_review_pending    |   1   | 8.0
no_follow_up_scheduled   |  15   | 21.2
stale_items              |   4   | 16.8
```

**Target goals**:
- Expired approvals: <5 at any time
- Overdue invoices: <3 at any time
- Awaiting files: <10 at any time
- Design review pending: <2 at any time

---

### Customer Conversations

**See all active conversations**:
```sql
SELECT * FROM customer_conversations
ORDER BY last_message_at DESC
LIMIT 20;
```

**What to look for**:
- Unread messages (prioritize these)
- Conversations >3 days old with no response
- High-value customers (L'Oreal, Luxottica, etc.)

---

## 🎓 Best Practices

### Daily Workflow

**Morning Routine** (30 minutes):
1. Check `/dashboard` - Review "My Actions Today"
2. Check `/stuck-items` - Focus on Priority 3 items
3. Clear untriaged emails from Email Intake
4. Set follow-up dates for all new work items

**Afternoon Routine** (15 minutes):
1. Check for new emails (auto-refresh every 15 min)
2. Review stuck items again (new items may appear)
3. Follow up on high-priority customers

**End of Day** (10 minutes):
1. Clear any remaining untriaged emails
2. Update work item statuses
3. Check tomorrow's follow-up queue
4. Make notes for tomorrow

---

### Email Hygiene

**DO**:
- ✅ Triage every email same day (move out of "Untriaged")
- ✅ Link emails to work items (helps with customer context)
- ✅ Set follow-up dates (prevents items from getting stuck)
- ✅ Update work item status when situation changes
- ✅ Use customer profiles to check history before responding

**DON'T**:
- ❌ Leave emails in "Untriaged" overnight
- ❌ Delete emails (system keeps full history)
- ❌ Ignore stuck items (they get worse over time)
- ❌ Forget to update "last_contact_at" after emailing customer
- ❌ Skip setting next follow-up date

---

### Customer Communication

**Before contacting customer**:
1. Check customer profile (`/customers/[id]`)
2. Review conversation history (all previous emails)
3. Check all work items (understand full relationship)
4. Note if VIP customer (L'Oreal, Luxottica, Ritz Carlton)

**When writing emails**:
1. Check quick reply templates first (faster than typing)
2. Personalize template (replace {{customer_name}}, etc.)
3. Set follow-up date after sending
4. Update work item status if needed

**After customer responds**:
1. Update "last_contact_at" to today
2. Set new follow-up date
3. Update work item status if progress made
4. Link email to work item if not auto-linked

---

## 🚀 Power User Tips

### Keyboard Shortcuts (Future Feature)

Quick reply templates will have keyboard shortcuts:
- Press `1` = Customization options
- Press `2` = Shipping timeline
- Press `3` = File requirements
- Press `4` = Design changes
- Press `5` = Payment terms
- Press `6` = Bulk discounts

*(UI not built yet - coming soon)*

---

### SQL Queries for Common Tasks

**Find all emails from a specific customer**:
```sql
SELECT subject, received_at, direction
FROM communications
WHERE from_email = 'customer@example.com'
ORDER BY received_at DESC;
```

**Find all work items with no follow-up date**:
```sql
SELECT id, title, customer_name, status
FROM work_items
WHERE next_follow_up_at IS NULL
AND closed_at IS NULL;
```

**Find customers with most orders**:
```sql
SELECT customer_email, COUNT(*) as order_count
FROM work_items
WHERE customer_email IS NOT NULL
GROUP BY customer_email
ORDER BY order_count DESC
LIMIT 20;
```

---

## ❓ FAQ

### Q: Why do some emails not auto-link to work items?

**A**: Auto-linking uses 5 strategies but isn't perfect. Manually link these cases:
- Brand new customer (no history to match)
- Customer used different email address
- Subject doesn't mention order number or project name

---

### Q: How do I mark an item as "not stuck"?

**A**: Update the work item:
- If "Expired Approval" → Regenerate link, update `last_contact_at`
- If "Overdue Invoice" → Record payment or send reminder
- If "Awaiting Files" → Mark as received or send reminder
- If "No Follow-up" → Set `next_follow_up_at` date

Item automatically disappears from stuck items when condition resolves.

---

### Q: Can I customize the quick reply templates?

**A**: Yes! Ask admin to update templates in database:
```sql
UPDATE quick_reply_templates
SET body_html_template = 'Your new template text here'
WHERE key = 'customization_options';
```

Or add new templates:
```sql
INSERT INTO quick_reply_templates (key, name, category, body_html_template, keyboard_shortcut)
VALUES ('your_template', 'Template Name', 'general', '<p>Your HTML here</p>', '7');
```

---

### Q: What if system links email to wrong work item?

**A**: Just manually change it:
1. Go to email in Email Intake
2. Click current work item link
3. Select correct work item from dropdown
4. Save

System learns from your corrections!

---

### Q: How often should I check stuck items?

**A**: Recommended schedule:
- **Priority 3 (High)**: Check 2x per day (morning + afternoon)
- **Priority 2 (Medium)**: Check 1x per day
- **Priority 1 (Low)**: Check 2x per week

---

## 🎉 You're Ready!

**Remember**:
- Dashboard is your command center - check it first
- Stuck items are your priority list - work from top down
- Customer profiles give you context - check before calling
- System handles reminders automatically - you just follow up
- Email auto-linking saves time - verify it's correct

**Questions?** Ask your admin or check the documentation in `/docs`.

**Happy operations! 🚀**
