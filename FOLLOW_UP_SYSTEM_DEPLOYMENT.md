# CRM Follow-Up System - Deployment Guide

## 🎉 Implementation Complete!

All code for the comprehensive CRM Lead Management System has been implemented. This guide will walk you through deploying and testing the system.

---

## 📦 What Was Built

### Database Layer (5 migrations)
1. **`20260204000001_add_follow_up_cadences.sql`** - Cadence configuration table
2. **`20260204000002_seed_follow_up_cadences.sql`** - 20+ pre-configured cadence rules
3. **`20260204000003_add_work_item_flags.sql`** - Tracking flags (rush_order, requires_initial_contact, etc.)
4. **`20260204000004_add_actioned_at_to_communications.sql`** - Inbox reply tracking
5. **`20260204000005_create_cadence_calculation_functions.sql`** - PostgreSQL functions for calculations

### API Routes (5 new routes)
- `POST /api/work-items/[id]/mark-followed-up` - Mark work item as contacted
- `POST /api/work-items/[id]/snooze` - Snooze follow-up for X days
- `POST /api/work-items/[id]/toggle-waiting` - Pause/resume follow-ups
- `POST /api/communications/[id]/mark-actioned` - Mark email as handled
- `GET /api/cron/recalculate-follow-ups` - Nightly recalculation job

### Frontend Pages (2 new pages)
- **`/follow-ups`** - Unified follow-up queue with 6 priority sections
- **`/inbox/replies`** - Customer responses needing attention

### Components (3 new components)
- **`SnoozeDialog`** - Snooze follow-up UI
- **`FollowUpItemCard`** - Reusable work item card with quick actions
- **`FollowUpActionBar`** - Work item detail page action bar

### Integrations
- **Email Webhook** - Auto-recalculates follow-ups on inbound emails
- **Shopify Webhook** - Flags orders without prior email contact
- **Status Changes** - Auto-recalculates follow-ups when status changes

---

## 🚀 Deployment Steps

### Step 1: Run Database Migrations

Navigate to your Supabase project dashboard:

```bash
# Option A: Via Supabase Dashboard SQL Editor
# 1. Go to https://supabase.com/dashboard/project/YOUR_PROJECT/sql/new
# 2. Run each migration file in order:

-- Migration 1
-- Copy/paste contents of: supabase/migrations/20260204000001_add_follow_up_cadences.sql

-- Migration 2
-- Copy/paste contents of: supabase/migrations/20260204000002_seed_follow_up_cadences.sql

-- Migration 3
-- Copy/paste contents of: supabase/migrations/20260204000003_add_work_item_flags.sql

-- Migration 4
-- Copy/paste contents of: supabase/migrations/20260204000004_add_actioned_at_to_communications.sql

-- Migration 5
-- Copy/paste contents of: supabase/migrations/20260204000005_create_cadence_calculation_functions.sql
```

```bash
# Option B: Via Supabase CLI (if you have it installed)
cd custom-ops
supabase db push
```

**Verify migrations ran successfully:**
```sql
-- Check tables exist
SELECT table_name FROM information_schema.tables
WHERE table_schema = 'public' AND table_name = 'follow_up_cadences';

-- Check functions exist
SELECT routine_name FROM information_schema.routines
WHERE routine_schema = 'public'
AND routine_name IN ('calculate_next_follow_up', 'recalculate_all_follow_ups', 'add_business_days');

-- Check columns added
SELECT column_name FROM information_schema.columns
WHERE table_name = 'work_items'
AND column_name IN ('requires_initial_contact', 'rush_order', 'missed_design_window', 'is_waiting');
```

### Step 2: Set Environment Variables

Add to your Vercel project (or `.env.local` for local development):

```bash
# Generate a secure random secret for the cron job
CRON_SECRET=your-random-secret-here

# Example: openssl rand -base64 32
# Or use: https://generate-secret.vercel.app/32
```

**In Vercel Dashboard:**
1. Go to Project Settings → Environment Variables
2. Add `CRON_SECRET` with your generated value
3. Apply to Production, Preview, and Development environments

### Step 3: Deploy to Vercel

```bash
cd custom-ops
git add .
git commit -m "feat: implement CRM follow-up management system"
git push origin main
```

Vercel will automatically deploy your changes.

### Step 4: Backfill Existing Work Items

After deployment, run this SQL to calculate follow-ups for existing work items:

```sql
-- Backfill follow-ups for all open work items
SELECT * FROM recalculate_all_follow_ups();

-- Verify results
SELECT
  id,
  customer_name,
  status,
  event_date,
  next_follow_up_at,
  follow_up_cadence_key,
  rush_order,
  requires_initial_contact
FROM work_items
WHERE closed_at IS NULL
ORDER BY next_follow_up_at ASC NULLS LAST
LIMIT 20;
```

### Step 5: Verify Cron Job

The nightly recalculation job is configured in `vercel.json` to run at 2 AM daily.

**Test the cron endpoint manually:**
```bash
curl -X GET https://your-app.vercel.app/api/cron/recalculate-follow-ups \
  -H "Authorization: Bearer YOUR_CRON_SECRET"
```

You should see a response like:
```json
{
  "success": true,
  "updated": 15,
  "timestamp": "2026-02-04T02:00:00.000Z",
  "changes": [...]
}
```

---

## 🧪 Testing the System

### Test 1: Email Inquiry → Follow-Up Flow

1. Send a test email to your monitored inbox
2. Go to **Email Intake** → email appears
3. Click **Create Lead** → enter event date 45 days out
4. Verify work item created with `next_follow_up_at` calculated
5. Navigate to **Follow-Ups** page → item appears in appropriate section
6. Click **Mark as Followed Up** → verify recalculates to 3-5 days from now

### Test 2: Shopify Order → Initial Contact

1. Create test Customify order in Shopify (or webhook simulator)
2. Verify work item created with `requires_initial_contact = true`
3. Navigate to **Follow-Ups** → item appears in "Needs Initial Contact"
4. Click **Mark as Followed Up** → flag clears, item moves to appropriate section

### Test 3: Rush Order Warning

1. Create lead with event date 20 days out
2. Verify `rush_order = true` flag set
3. Verify item appears in "Rush / Too Late" section
4. Verify orange badge on work item detail page

### Test 4: Customer Reply Updates Follow-Up

1. Create work item with follow-up scheduled
2. Send inbound email (reply to work item thread)
3. Verify `last_contact_at` updates
4. Verify `next_follow_up_at` recalculates
5. Go to **Inbox Replies** → email appears
6. Click **Mark as Actioned** → email disappears

### Test 5: Snooze & Waiting Toggle

1. Open work item detail page
2. Click **Snooze** → select "3 days"
3. Verify `next_follow_up_at` updates to 3 days from now
4. Click **Mark as Waiting**
5. Verify `is_waiting = true` and `next_follow_up_at = null`
6. Click **Resume** → verify recalculates follow-up

### Test 6: Nightly Recalculation

1. Manually trigger cron endpoint (see Step 5 above)
2. Verify open work items recalculated
3. Check work item with approaching event → verify escalated cadence
4. Check closed work items → verify no follow-up set

---

## 📊 Follow-Up Cadence Rules

The system includes 20+ pre-configured cadence rules:

### Assisted Projects (Custom Design Pipeline)
- **New Inquiry** (event <30 days): 2-day follow-up (RUSH)
- **New Inquiry** (30-60 days): 3-day follow-up
- **New Inquiry** (60-90 days): 5-day follow-up
- **New Inquiry** (90+ days): 7-day follow-up
- **New Inquiry** (no event): 7-day follow-up (wholesale)
- **Proof Sent**: 3-day urgent follow-up
- **Invoice Sent**: 4-day follow-up
- **Design Fee Paid**: Pauses follow-up (internal work)

### Customify Orders (Shopify Fulfillment)
- **Needs Customer Fix**: 3-day follow-up
- **Needs Design Review**: Paused (internal work)
- **Approved/Batched/Shipped**: Paused (production stages)

---

## 🎯 Key Features

### 1. Event-Aware Scheduling
- Automatically escalates urgency as event date approaches
- Rush detection for events <30 days out
- Missed design window alerts for events <15 days

### 2. Unified Follow-Up Queue (`/follow-ups`)
6 prioritized sections:
- 🔴 **URGENT** - Overdue + blocking statuses
- 🆕 **NEEDS INITIAL CONTACT** - Shopify-first orders
- 🟡 **DUE TODAY** - Scheduled for today
- ⚠️ **RUSH / TOO LATE** - Event <30 days
- 📅 **DUE THIS WEEK** - Next 7 days
- ⏸️ **WAITING ON CUSTOMER** - Paused

### 3. Inbox Replies (`/inbox/replies`)
- Shows unactioned customer responses
- Prevents missed replies to existing work items
- Quick actions: Mark as Actioned, Open Work Item

### 4. Manual Controls
- **Mark as Followed Up** - Updates last contact, recalculates follow-up
- **Snooze** - Postpone for 1/3/7 days or custom
- **Waiting on Customer** - Pauses follow-ups until resumed
- All actions work from both queue pages and work item detail

### 5. Automatic Recalculation
- **On status change** - Adapts to workflow progression
- **On inbound email** - Resets clock when customer replies
- **Nightly cron** - Keeps all dates current
- **On new Shopify order** - Sets initial follow-up

---

## 🔧 Customizing Cadences

To modify follow-up rules, update the `follow_up_cadences` table:

```sql
-- Example: Change proof_sent urgency from 3 to 2 days
UPDATE follow_up_cadences
SET follow_up_days = 2
WHERE cadence_key = 'assisted_proof_sent';

-- Add new cadence rule
INSERT INTO follow_up_cadences (
  cadence_key, name, description,
  work_item_type, status,
  days_until_event_min, days_until_event_max,
  follow_up_days, priority
) VALUES (
  'custom_rule_key',
  'Custom Rule Name',
  'Description of when this applies',
  'assisted_project',
  'custom_status',
  NULL, NULL, -- Event range (null = any)
  5,          -- Days until follow-up
  100         -- Priority (higher wins)
);
```

---

## 🐛 Troubleshooting

### Issue: Follow-ups not calculating
**Check:**
1. PostgreSQL functions installed: `SELECT * FROM recalculate_all_follow_ups();`
2. Cadences seeded: `SELECT COUNT(*) FROM follow_up_cadences;` (should be 20+)
3. Work item has status: `SELECT status FROM work_items WHERE id = 'xxx';`

### Issue: Cron job not running
**Check:**
1. `vercel.json` deployed: `cat vercel.json`
2. Environment variable set: Vercel Dashboard → Environment Variables
3. Manual test works: `curl` command from Step 5

### Issue: Inbox Replies not showing
**Check:**
1. `actioned_at` column exists: `SELECT actioned_at FROM communications LIMIT 1;`
2. Work item linked: `SELECT work_item_id FROM communications WHERE direction = 'inbound';`

---

## 📈 Success Metrics

After deployment, you should see:
- ✅ All open work items have `next_follow_up_at` dates
- ✅ Follow-Ups page shows work by priority
- ✅ Inbound emails update `last_contact_at` automatically
- ✅ Shopify orders without email history flagged
- ✅ Rush orders highlighted with badges
- ✅ Nightly cron keeps dates current

---

## 🎓 Next Steps

### Recommended enhancements (not in current scope):
1. **Email Digest** - Daily summary of follow-ups due
2. **Slack Notifications** - Alert on overdue follow-ups
3. **Auto-Send Templates** - One-click follow-up emails
4. **Lead Scoring** - Track engagement over time
5. **Metrics Dashboard** - Response rates, conversion tracking

### Current capabilities ready to use:
- ✅ Event-aware follow-up scheduling
- ✅ Manual snooze/waiting controls
- ✅ Unified priority queue
- ✅ Inbox reply tracking
- ✅ Shopify-first order detection
- ✅ Automatic recalculation
- ✅ Rush order alerts

---

## 📝 Files Changed/Created

### New Files (27 total)
**Migrations (5):**
- `supabase/migrations/20260204000001_add_follow_up_cadences.sql`
- `supabase/migrations/20260204000002_seed_follow_up_cadences.sql`
- `supabase/migrations/20260204000003_add_work_item_flags.sql`
- `supabase/migrations/20260204000004_add_actioned_at_to_communications.sql`
- `supabase/migrations/20260204000005_create_cadence_calculation_functions.sql`

**API Routes (5):**
- `app/api/work-items/[id]/mark-followed-up/route.ts`
- `app/api/work-items/[id]/snooze/route.ts`
- `app/api/work-items/[id]/toggle-waiting/route.ts`
- `app/api/communications/[id]/mark-actioned/route.ts`
- `app/api/cron/recalculate-follow-ups/route.ts`

**Pages (2):**
- `app/(dashboard)/follow-ups/page.tsx`
- `app/(dashboard)/inbox/replies/page.tsx`

**Components (3):**
- `components/work-items/snooze-dialog.tsx`
- `components/work-items/follow-up-item-card.tsx`
- `components/work-items/follow-up-action-bar.tsx`

**Config (1):**
- `vercel.json`

### Modified Files (5)
- `lib/hooks/use-work-items.ts` - Added follow-up hooks and auto-recalc on status change
- `app/(dashboard)/work-items/[id]/page.tsx` - Added FollowUpActionBar
- `app/(dashboard)/layout.tsx` - Added navigation links
- `app/api/webhooks/email/route.ts` - Added follow-up recalc on inbound email
- `app/api/webhooks/shopify/route.ts` - Added initial contact flag + follow-up calc

---

## ✅ Deployment Checklist

- [ ] Run all 5 database migrations in Supabase
- [ ] Verify tables/functions created (see Step 1)
- [ ] Set `CRON_SECRET` environment variable in Vercel
- [ ] Deploy code to Vercel (`git push`)
- [ ] Backfill existing work items (run `recalculate_all_follow_ups()`)
- [ ] Test cron endpoint manually
- [ ] Test email → follow-up flow
- [ ] Test Shopify → initial contact flow
- [ ] Test snooze/waiting controls
- [ ] Verify navigation links work
- [ ] Check Follow-Ups page loads with sections
- [ ] Check Inbox Replies page loads

---

## 🙋 Questions or Issues?

If you encounter any issues during deployment:
1. Check the troubleshooting section above
2. Verify each migration ran successfully
3. Check browser console for frontend errors
4. Check Vercel logs for backend errors
5. Verify environment variables are set correctly

The system is designed to be resilient - if follow-up calculation fails, it won't break the core workflow. Work items will still function normally.

---

**Built with ❤️ for The Gay Fan Club**
*Ensuring no customer is ever forgotten* 🌈
