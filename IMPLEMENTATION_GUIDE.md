# Implementation Guide - Making It All Work

This guide answers all your questions about deploying and using the system.

---

## 🚀 DEPLOYMENT STEPS (Do This First)

### Step 1: Run Database Migrations

**Location:** `/migrations-to-run/` folder

Go to Supabase Dashboard → SQL Editor and run these **in order**:

1. `01_email_deduplication.sql` - Better duplicate detection
2. `02_dead_letter_queue.sql` - Error retry system
3. `03_stuck_items.sql` - Stuck items detection
4. **`04_email_filters.sql`** - ⭐ **CRITICAL** - Domain-based spam filtering
5. `05_conversations.sql` - Email threading
6. `06_reminder_engine.sql` - Automated follow-ups
7. `07_quick_replies.sql` - Quick reply templates

**After each migration, check for errors in the console.**

### Step 2: Deploy to Vercel

I just added the batch email cron to `vercel.json`. Now:

```bash
git add .
git commit -m "Add batch email cron job"
git push
```

Vercel will auto-deploy.

### Step 3: Configure Environment Variables

Make sure these are set in Vercel → Settings → Environment Variables:

```bash
# Supabase (Required)
NEXT_PUBLIC_SUPABASE_URL=your-project-url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# Microsoft 365 (Required for email)
MICROSOFT_TENANT_ID=your-tenant-id
MICROSOFT_CLIENT_ID=your-client-id
MICROSOFT_CLIENT_SECRET=your-client-secret
MICROSOFT_MAILBOX_EMAIL=sales@thegayfanclub.com

# Cron Security (Required)
CRON_SECRET=your-secret-key-here

# Shopify (Optional - if you want order sync)
SHOPIFY_SHOP_DOMAIN=your-shop.myshopify.com
SHOPIFY_ADMIN_API_TOKEN=your-admin-token
SHOPIFY_WEBHOOK_SECRET=your-webhook-secret
```

### Step 4: Verify Cron Jobs Are Running

After deployment, check Vercel → Deployments → Cron Logs to ensure:

- ✅ Email import runs every 15 minutes
- ✅ Batch email processor runs every 5 minutes
- ✅ Follow-up recalculation runs daily at 2 AM

---

## 📧 EMAIL SYSTEM - HOW IT WORKS

### "What about spam emails or notifications?"

**Auto-Filtered! Here's how:**

1. **Domain Filters (Highest Priority)**
   Migration `04_email_filters.sql` creates filters for:
   - ❌ **Spam:** `@360onlineprint.com` → auto-categorized as "spam"
   - 📦 **Notifications:** `@shopify.com`, `@noreply`, `@no-reply` → categorized as "other"
   - ✅ **VIP Customers:** `@loreal.com`, `@luxottica.com`, `@ritzcarltoncruise.com` → "primary"
   - 📝 **Form Providers:** `@powerfulform.com`, `forms-noreply@google.com` → "primary"

2. **Keyword Fallback**
   If no domain filter matches, uses keywords:
   - **Support:** missing, damaged, refund, wrong, problem, issue
   - **Spam:** unsubscribe, marketing, promotion

3. **Junk Filter**
   Blocks completely: `noreply@`, `donotreply@`, `mailer-daemon@`, `bounce@`

**Staff never see spam emails in "My Actions Today" - they only see "primary" category!**

### "When working with a client, where do their emails show up?"

**Auto-links to work items! Here's the flow:**

1. **Email arrives** → Auto-import every 15 minutes
2. **Auto-linking tries 5 strategies** (in order):
   - Thread ID (previous conversation)
   - Order number in subject/body
   - Email address matches work item customer_email
   - Email matches work item title
   - Subject matches work item title

3. **If linked:**
   - ✅ Shows in Email Intake with work item badge
   - ✅ Shows in work item's Communications tab
   - ✅ Auto-categorized based on domain filters
   - ✅ Removed from "My Actions Today" (already handled)

4. **If NOT linked (new inquiry):**
   - Shows in Email Intake → "Primary" tab
   - Shows in "My Actions Today" as "Untriaged email"
   - Staff clicks "Create Lead" → Becomes Assisted Project

**Example:**

```
Customer: sarah@loreal.com
Status: New inquiry

Email 1 (Day 1): "Hi, need 500 custom fans"
→ Auto-categorized as "primary" (@loreal.com filter)
→ No work item yet → Shows in Email Intake
→ Staff clicks "Create Lead"
→ Creates Assisted Project: "L'Oreal - Custom Fans"

Email 2 (Day 3): "Re: Quote for fans"
→ Auto-links to "L'Oreal - Custom Fans" (thread ID)
→ Removed from Email Intake
→ Shows in work item page → Communications tab
→ Staff replies from work item page

Email 3 (Day 7): "Re: Quote for fans"
→ Auto-links (thread ID)
→ Work item page → Communications tab
```

---

## 🎯 DAILY WORKFLOW - How Staff "Work The System"

### Morning Routine (30 minutes)

1. **Open `/dashboard`**
2. **Work "My Actions Today" widget top-to-bottom:**

**What shows in "My Actions Today":**

```
🔴 HIGH PRIORITY
- Untriaged emails (new inquiries needing triage)
- Follow-ups due today (promised check-ins)
- DLQ failures (technical errors needing manual fix)

🟡 MEDIUM PRIORITY
- Designs awaiting customer approval
- Design review queue (Customify orders to approve)
```

**How to clear each item:**

- **Untriaged email** → Click → Create Lead OR Link to existing work item OR Archive if spam
- **Follow-up due** → Click → Send update → Set next_follow_up_at OR Close if done
- **Design awaiting approval** → Customer needs to approve (just monitor)
- **Design review** → Click → Approve OR Request fixes
- **DLQ failure** → Click → Fix manually → Mark resolved

**When "My Actions Today" is empty → ✨ You're done!**

### Weekly Task (Monday, 15 minutes)

1. **Open `/stuck-items`**
2. **Unstick each item:**
   - Expired approval → Resend approval link
   - Overdue invoice → Send payment reminder
   - Awaiting files → Follow up with customer
   - No follow-up → Set next_follow_up_at

---

## 🎨 UI/UX IMPROVEMENTS ALREADY BUILT

### Email Intake Page

✅ **Category Tabs** (Primary/Promotional/Spam/Notifications)
✅ **Linked Work Item Badges** - Shows order number on emails
✅ **Bulk Actions** - Select multiple → Archive or Move to category
✅ **Create Filter Rules** - Move to spam + auto-create filter for domain
✅ **Grouped by Sender** - All emails from same person grouped
✅ **Thread View** - See full conversation
✅ **Search** - Search by sender, subject, or content

### Dashboard

✅ **My Actions Today Widget** - Prioritized list (high → medium → low)
✅ **Stuck Items Card** - Red flag when items need attention
✅ **Auto-refresh** - Updates every 2 minutes
✅ **Clickable Cards** - Click to go directly to that queue

### Work Item Pages

✅ **Communications Tab** - See all emails for this customer
✅ **Quick Reply** - Reply directly from work item page
✅ **Email Thread** - See conversation history
✅ **Link Emails** - Manually link emails if auto-link missed

---

## 🐛 KNOWN ISSUES & FIXES

### Issue 1: Too Many Notification Emails in Email Intake

**Status:** ✅ **FIXED** (Migration #4)

After running `04_email_filters.sql`, Shopify/noreply/notification emails will be auto-categorized as "other" and hidden from "My Actions Today".

Staff can still see them by clicking the "Notifications" tab in Email Intake if needed.

### Issue 2: Emails Not Auto-Linking

**Status:** ✅ **WORKING** (5 strategies implemented)

If emails still aren't linking:
1. Check order number is in subject or body
2. Verify customer_email matches on work item
3. Use "Link Emails" button on work item page (manual backup)

### Issue 3: Spam Still Shows in Primary Tab

**Status:** 🔧 **ACTION NEEDED**

After deployment, go to Email Intake → Find a spam email → Click "More Actions" → "Move to Spam & Create Filter"

This creates a domain filter rule so future emails from that sender auto-categorize as spam.

**Staff should do this for first 2 weeks** to train the system on your specific spam senders.

---

## 📊 WHAT EACH NAVIGATION ITEM DOES

### Daily Use (Use These Every Day)
| Page | Purpose | When to Use |
|------|---------|-------------|
| **Dashboard** | Command center | START HERE - work "My Actions Today" |
| **Work Items** | All projects | Search for specific customer/order |
| **Email Intake** | Triage center | Only if "My Actions Today" shows untriaged emails |

### Weekly Use
| Page | Purpose | When to Use |
|------|---------|-------------|
| **Stuck Items** | Find what fell through cracks | Every Monday morning |
| **Batches** | Create production batches | When "Ready for Batch" hits 10-20 items |

### Ignore These (Auto-Populated or Redundant)
| Page | Why Ignore | Alternative |
|------|------------|-------------|
| **Follow-Ups** | Already in "My Actions Today" | Use Dashboard instead |
| **Inbox Replies** | Reply from work item pages | Not a standalone queue |
| **Support Queue** | Email Intake filtered view | Use Email Intake → filter by keyword |
| **Design Review** | Already in "My Actions Today" | Use Dashboard instead |
| **Custom Design Queue** | Work Items filtered view | Use Work Items → filter by type |
| **Approved Designs** | Work Items filtered view | Use Work Items → filter by status |

**Simplified Navigation:** Staff should bookmark `/dashboard` and `/work-items`. Everything else is accessible from there.

---

## 🔧 ADDITIONAL ORGANIZATION FEATURES

### 1. Email Filters (Already Built)

**Add Custom Filters:**

Go to Supabase → Table Editor → `email_filters` → Insert Row:

```sql
-- Example: Block marketing from a vendor
filter_type: 'domain'
pattern: '@unwantedvendor.com'
action: 'categorize'
target_category: 'spam'
name: 'Block Unwanted Vendor'
priority: 10

-- Example: Prioritize VIP customer
filter_type: 'domain'
pattern: '@vipcustomer.com'
action: 'categorize'
target_category: 'primary'
name: 'VIP Customer - Auto-Priority'
priority: 5
```

**Lower priority = runs first** (1 = highest priority)

### 2. Quick Reply Templates (Already Built)

After running migration `07_quick_replies.sql`, staff can use templates:

**UI Not Built Yet** - For now, templates are in `quick_reply_templates` table.

**Manual Usage:**
1. Go to Supabase → Table Editor → `quick_reply_templates`
2. Copy template text
3. Paste into reply form

**Future:** Add dropdown in Email Intake UI to select templates.

### 3. Automated Reminders (Already Built)

After running migration `06_reminder_engine.sql`, system auto-creates reminders:

- **Approval Expiring Soon** - 2 days before 14-day expiration
- **Payment Overdue** - 3 days after due date
- **Files Needed** - 5 days after requesting files
- **Design Review Overdue** - 7 days with no review

**Shows in "My Actions Today" automatically!**

---

## ✅ IS EVERYTHING CONNECTED PROPERLY?

### Connectivity Checklist

**After deployment, verify:**

1. **Email Import Working?**
   - Vercel → Cron Logs → Check `/api/cron/import-emails` runs every 15min
   - Should show: `imported: X, skipped: Y, filtered: Z`

2. **Email Filters Applied?**
   - Send test email from known spam domain
   - Check Email Intake → Should be in "Spam" or "Notifications" tab
   - Check Supabase → `email_filters` → `match_count` should increment

3. **Auto-Linking Working?**
   - Reply to an existing order confirmation email
   - Check Email Intake → Should show work item badge
   - Check work item page → Should show in Communications tab

4. **Stuck Items Detecting?**
   - Open `/stuck-items`
   - Should show items with expired approvals, overdue invoices, etc.
   - If empty → Good! Nothing stuck.

5. **Dashboard Aggregating?**
   - Open `/dashboard`
   - "My Actions Today" should show pending items
   - Counts should match individual queue pages

---

## 🎓 STAFF TRAINING (2 Minutes)

**Training Script:**

> "Every morning, open the Dashboard. Work the 'My Actions Today' list from top to bottom. When the list is empty, you're done. If you're not sure what to do with an item, click it and the page will show you the actions available. Red items are urgent, yellow are important, blue are normal."

**That's it. That's the whole training.**

---

## 🚨 WHAT TO DO IF SOMETHING BREAKS

### Email Import Stops Working

1. Check Vercel → Cron Logs → Look for errors
2. Check Vercel → Environment Variables → Verify Microsoft credentials
3. Check Supabase → Table Editor → `dead_letter_queue` → Look for failed operations
4. Check "My Actions Today" → DLQ failures will show there

### Auto-Linking Stops Working

1. Check migration `01_email_deduplication.sql` was run
2. Check work item has `customer_email` or `shopify_order_number` set
3. Use "Link Emails" button on work item page (manual backup)

### Stuck Items Not Showing

1. Check migration `03_stuck_items.sql` was run
2. Check Supabase → Views → `stuck_items_view` exists
3. Refresh page (cached for 5 minutes)

### Dashboard Counts Wrong

1. Hard refresh (Cmd+Shift+R or Ctrl+Shift+R)
2. Check Supabase → Verify data in `work_items` and `communications` tables
3. Check browser console for errors

---

## 📈 SUCCESS METRICS (After 7 Days)

**You'll know it's working when:**

- ✅ Email Intake → Primary tab has <10 emails (rest auto-categorized)
- ✅ "My Actions Today" widget is empty by end of day
- ✅ Stuck Items page shows <5 items
- ✅ Work items auto-linked = >80% of incoming emails
- ✅ Staff says "I know what to work on next" without asking

---

## 🎯 NEXT STEPS

### Immediate (Today)
1. ✅ Run 7 migrations in Supabase
2. ✅ Push vercel.json update (already done)
3. ✅ Verify deployment succeeded
4. ✅ Check cron jobs are running

### This Week
1. Train staff on "My Actions Today" workflow
2. Add email filters for your specific spam senders
3. Monitor Stuck Items page daily
4. Verify auto-linking is working

### Next Week
1. Review email filter stats (which filters matching most)
2. Add custom reminder templates
3. Create quick reply templates
4. Measure: How many emails auto-linked? How many stuck items?

---

## 💡 PRO TIPS

1. **Use bulk actions in Email Intake** - Select all spam from a sender → Move to spam & create filter (trains the system)

2. **Check Stuck Items every Monday** - Prevents things from falling through cracks for weeks

3. **Reply from work item pages, not Email Intake** - More context, auto-links reply to work item

4. **Create filter rules liberally** - Every time you mark something as spam, create a filter. Future emails auto-categorized.

5. **Use search in Work Items** - Faster than scrolling through queues

6. **Bookmark `/dashboard`** - Should be your browser home page

---

## 🆘 GETTING HELP

**If you're stuck:**

1. Check Supabase → Table Editor → `dead_letter_queue` for error messages
2. Check Vercel → Cron Logs for import failures
3. Check browser console (F12) for JavaScript errors
4. Check this guide's "What to Do If Something Breaks" section

**Common Questions:**

Q: "Emails aren't importing"
A: Check Microsoft 365 credentials in Vercel env vars

Q: "Emails not auto-linking"
A: Use "Link Emails" button as backup, verify customer_email matches

Q: "Too much spam in Email Intake"
A: Click spam email → More Actions → Move to Spam & Create Filter

Q: "What do I work on next?"
A: Dashboard → "My Actions Today" → Top item

Q: "Where are client emails?"
A: Auto-linked to work item → Go to work item page → Communications tab

---

**That's everything! The system is 90% done. Run the migrations, deploy, and you're live.** 🚀
