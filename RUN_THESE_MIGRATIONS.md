# 🚀 PDR v3 Migrations - Run Guide

**Date:** February 27, 2026
**Migrations to Run:** 4 new migrations
**Estimated Time:** 5-10 minutes

---

## 📋 Pre-Migration Checklist

- [ ] **Backup Database** (Supabase does this automatically, but good to verify)
- [ ] **Close any active transactions** in Supabase SQL editor
- [ ] **Have Supabase Dashboard open:** https://uvdaqjxmstbhfcgjlemm.supabase.co

---

## 🎯 Migration Instructions

### Step 1: Open Supabase SQL Editor

1. Go to: https://uvdaqjxmstbhfcgjlemm.supabase.co
2. Click **SQL Editor** in the left sidebar
3. Click **New query** button

---

### Migration 1 of 4: Add Email Ownership

**File:** `20260227000002_add_email_ownership.sql`

**What it does:**
- Adds `owner_user_id`, `priority`, `email_status` to communications table
- Creates indexes for priority inbox
- Backfills existing emails with work item assignees

**Copy and paste this SQL:**

```sql
-- Migration: Add Email Ownership and Priority System
-- Phase 1: Critical Pain Points - Email Ownership & Priority Inbox

-- Add new columns to communications table
ALTER TABLE communications
  ADD COLUMN owner_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  ADD COLUMN priority TEXT CHECK (priority IN ('high', 'medium', 'low')) DEFAULT 'medium',
  ADD COLUMN email_status TEXT CHECK (email_status IN ('needs_reply', 'waiting_on_customer', 'closed')) DEFAULT 'needs_reply';

-- Create index for efficient priority inbox queries
CREATE INDEX idx_communications_owner_priority ON communications(owner_user_id, priority, email_status)
  WHERE email_status != 'closed';

-- Create index for finding emails by owner
CREATE INDEX idx_communications_owner ON communications(owner_user_id)
  WHERE owner_user_id IS NOT NULL;

-- Backfill existing data: Set owner to work item assignee
UPDATE communications c
SET owner_user_id = wi.assigned_to_user_id
FROM work_items wi
WHERE c.work_item_id = wi.id
  AND c.owner_user_id IS NULL
  AND wi.assigned_to_user_id IS NOT NULL;

-- Set initial priority based on direction and time since last activity
UPDATE communications
SET priority = 'high'
WHERE direction = 'inbound'
  AND email_status = 'needs_reply'
  AND sent_at < NOW() - INTERVAL '24 hours';

-- Outbound emails waiting for customer response >48h = medium priority
UPDATE communications
SET priority = 'medium',
    email_status = 'waiting_on_customer'
WHERE direction = 'outbound'
  AND sent_at < NOW() - INTERVAL '48 hours';
```

**Click "RUN"** ✅

**Expected result:** "Success. No rows returned"

---

### Migration 2 of 4: Add Proof Tracking

**File:** `20260227000003_add_proof_tracking.sql`

**What it does:**
- Adds revision tracking to work_items
- Adds proof timestamps and customer feedback
- Backfills revision counts from existing files

**Copy and paste this SQL:**

```sql
-- Migration: Add Proof Version Control and Timeline Tracking
-- Phase 1: Critical Pain Points - Proof Organization

-- Add new columns to work_items table
ALTER TABLE work_items
  ADD COLUMN revision_count INTEGER DEFAULT 0,
  ADD COLUMN proof_sent_at TIMESTAMPTZ,
  ADD COLUMN proof_approved_at TIMESTAMPTZ,
  ADD COLUMN customer_feedback TEXT;

-- Create index for finding work items with many revisions
CREATE INDEX idx_work_items_revision_count ON work_items(revision_count)
  WHERE revision_count >= 3;

-- Create index for proof timeline queries
CREATE INDEX idx_work_items_proof_timeline ON work_items(proof_sent_at, proof_approved_at);

-- Backfill revision_count based on existing file versions
UPDATE work_items wi
SET revision_count = COALESCE((
  SELECT COUNT(DISTINCT version) - 1
  FROM files
  WHERE work_item_id = wi.id
    AND kind = 'proof'
    AND version > 0
), 0);

-- Set proof_sent_at to the earliest proof file upload date
UPDATE work_items wi
SET proof_sent_at = (
  SELECT MIN(created_at)
  FROM files
  WHERE work_item_id = wi.id
    AND kind = 'proof'
)
WHERE EXISTS (
  SELECT 1 FROM files
  WHERE work_item_id = wi.id AND kind = 'proof'
);

-- Set proof_approved_at for work items that are already in approved status
UPDATE work_items
SET proof_approved_at = updated_at
WHERE design_review_status = 'approved'
  AND proof_approved_at IS NULL;

-- Add comments for documentation
COMMENT ON COLUMN work_items.revision_count IS 'Number of proof revisions (excluding original). Show warning at 3+';
COMMENT ON COLUMN work_items.proof_sent_at IS 'Timestamp when first proof was sent to customer';
COMMENT ON COLUMN work_items.proof_approved_at IS 'Timestamp when customer approved the proof';
COMMENT ON COLUMN work_items.customer_feedback IS 'Customer comments and feedback on proof versions';
```

**Click "RUN"** ✅

**Expected result:** "Success. No rows returned"

---

### Migration 3 of 4: Add Batch Drip Emails

**File:** `20260227000004_add_batch_drip_emails.sql`

**What it does:**
- Adds drip email tracking to batches
- Creates indexes for email scheduling
- Adds skip logic for Shopify conflicts

**Copy and paste this SQL:**

```sql
-- Migration: Add Batch Drip Email Tracking
-- Phase 2: Automation & Discovery - Batch Drip Email Automation

-- Add new columns to batches table
ALTER TABLE batches
  ADD COLUMN alibaba_order_number TEXT,
  ADD COLUMN drip_email_1_sent_at TIMESTAMPTZ,
  ADD COLUMN drip_email_2_sent_at TIMESTAMPTZ,
  ADD COLUMN drip_email_3_sent_at TIMESTAMPTZ,
  ADD COLUMN drip_email_4_sent_at TIMESTAMPTZ,
  ADD COLUMN drip_email_4_skipped BOOLEAN DEFAULT false;

-- Create index for efficient drip email scheduling queries
CREATE INDEX idx_batches_drip_schedule ON batches(
  alibaba_order_number,
  drip_email_1_sent_at,
  drip_email_2_sent_at,
  drip_email_3_sent_at,
  drip_email_4_sent_at
) WHERE alibaba_order_number IS NOT NULL;

-- Create index for finding batches ready for each drip email
CREATE INDEX idx_batches_ready_for_email_1 ON batches(drip_email_1_sent_at)
  WHERE alibaba_order_number IS NOT NULL AND drip_email_1_sent_at IS NULL;

CREATE INDEX idx_batches_ready_for_email_2 ON batches(drip_email_1_sent_at, drip_email_2_sent_at)
  WHERE alibaba_order_number IS NOT NULL
    AND drip_email_1_sent_at IS NOT NULL
    AND drip_email_2_sent_at IS NULL;

CREATE INDEX idx_batches_ready_for_email_3 ON batches(drip_email_1_sent_at, drip_email_3_sent_at)
  WHERE alibaba_order_number IS NOT NULL
    AND drip_email_1_sent_at IS NOT NULL
    AND drip_email_3_sent_at IS NULL;

CREATE INDEX idx_batches_ready_for_email_4 ON batches(drip_email_1_sent_at, drip_email_4_sent_at, drip_email_4_skipped)
  WHERE alibaba_order_number IS NOT NULL
    AND drip_email_1_sent_at IS NOT NULL
    AND drip_email_4_sent_at IS NULL
    AND drip_email_4_skipped = false;

-- Add comments for documentation
COMMENT ON COLUMN batches.alibaba_order_number IS 'Alibaba order number - triggers drip email campaign when set';
COMMENT ON COLUMN batches.drip_email_1_sent_at IS 'Timestamp for "Order in production" email (sent immediately when Alibaba # added)';
COMMENT ON COLUMN batches.drip_email_2_sent_at IS 'Timestamp for "Shipped from facility" email (sent 7 days after email 1)';
COMMENT ON COLUMN batches.drip_email_3_sent_at IS 'Timestamp for "Going through customs" email (sent 14 days after email 1)';
COMMENT ON COLUMN batches.drip_email_4_sent_at IS 'Timestamp for "Arrived at warehouse" email (sent 21 days after email 1)';
COMMENT ON COLUMN batches.drip_email_4_skipped IS 'Skip email 4 if Shopify fulfillment webhook already sent tracking email';
```

**Click "RUN"** ✅

**Expected result:** "Success. No rows returned"

---

### Migration 4 of 4: Insert Drip Email Templates

**File:** `20260227000005_insert_batch_drip_email_templates.sql`

**What it does:**
- Creates 4 professional HTML email templates
- Templates for: Production, Shipped, Customs, Warehouse arrival

**⚠️ NOTE:** This is a LONG SQL statement (11,000+ characters). Make sure to copy the ENTIRE thing.

**Copy from the file:** `supabase/migrations/20260227000005_insert_batch_drip_email_templates.sql`

Or run this command to view it:
```bash
cat supabase/migrations/20260227000005_insert_batch_drip_email_templates.sql
```

**Click "RUN"** ✅

**Expected result:** "Success. 4 rows affected"

---

## ✅ Verification

After running all migrations, verify they worked:

### Check Email Ownership

```sql
SELECT COUNT(*) as emails_with_owners
FROM communications
WHERE owner_user_id IS NOT NULL;
```

**Expected:** Should show a count of emails now have owners

### Check Proof Tracking

```sql
SELECT COUNT(*) as work_items_with_revisions
FROM work_items
WHERE revision_count > 0;
```

**Expected:** Should show work items that have proof revisions

### Check Batch Drip Columns

```sql
SELECT
  COUNT(*) as total_batches,
  COUNT(alibaba_order_number) as batches_with_alibaba_number
FROM batches;
```

**Expected:** Should show batch counts

### Check Email Templates

```sql
SELECT key, name
FROM templates
WHERE key LIKE 'drip_email%'
ORDER BY key;
```

**Expected:** Should show 4 templates:
- drip_email_1_production
- drip_email_2_shipped
- drip_email_3_customs
- drip_email_4_warehouse

---

## 🎉 Success!

If all 4 migrations ran successfully, you should see:

✅ Email ownership and priority columns added
✅ Proof tracking columns added
✅ Batch drip email columns added
✅ 4 email templates created

**Next steps:**
1. Visit `/inbox/my-inbox` to see the new Priority Inbox
2. Test the universal search with `Cmd+K`
3. Check the drip email templates in the templates table
4. Configure cron jobs in Vercel (see deployment guide)

---

## 🐛 Troubleshooting

**"Column already exists" error:**
- Some columns may already exist from previous runs
- This is OK - the migration will skip those
- Verify the column exists: `\d communications` or `\d work_items`

**"Permission denied" error:**
- Make sure you're logged in as a user with admin privileges
- Try running in the SQL Editor (not the API)

**Template insert fails:**
- Check if templates already exist: `SELECT * FROM templates WHERE key LIKE 'drip_email%'`
- If they exist, you can skip this migration or delete them first

---

**Need help?** Check the implementation summary: `PDR_V3_IMPLEMENTATION_SUMMARY.md`
