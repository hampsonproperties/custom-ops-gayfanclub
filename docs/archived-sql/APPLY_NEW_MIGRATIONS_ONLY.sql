-- PDR v3 Migrations - Apply Only New Columns
-- Run this in Supabase SQL Editor if migrations haven't been applied yet

-- ============================================================================
-- Migration 1: Add Email Ownership (if not exists)
-- ============================================================================
DO $$
BEGIN
  -- Add owner_user_id if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'communications' AND column_name = 'owner_user_id'
  ) THEN
    ALTER TABLE communications
      ADD COLUMN owner_user_id UUID REFERENCES users(id) ON DELETE SET NULL;

    CREATE INDEX idx_communications_owner ON communications(owner_user_id)
      WHERE owner_user_id IS NOT NULL;
  END IF;

  -- Add priority if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'communications' AND column_name = 'priority'
  ) THEN
    ALTER TABLE communications
      ADD COLUMN priority TEXT CHECK (priority IN ('high', 'medium', 'low')) DEFAULT 'medium';
  END IF;

  -- Add email_status if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'communications' AND column_name = 'email_status'
  ) THEN
    ALTER TABLE communications
      ADD COLUMN email_status TEXT CHECK (email_status IN ('needs_reply', 'waiting_on_customer', 'closed')) DEFAULT 'needs_reply';
  END IF;
END $$;

-- Create index for priority inbox if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes WHERE indexname = 'idx_communications_owner_priority'
  ) THEN
    CREATE INDEX idx_communications_owner_priority ON communications(owner_user_id, priority, email_status)
      WHERE email_status != 'closed';
  END IF;
END $$;

-- Backfill existing data
UPDATE communications c
SET owner_user_id = wi.assigned_to_user_id
FROM work_items wi
WHERE c.work_item_id = wi.id
  AND c.owner_user_id IS NULL
  AND wi.assigned_to_user_id IS NOT NULL;

-- Set initial priority
UPDATE communications
SET priority = 'high'
WHERE direction = 'inbound'
  AND email_status = 'needs_reply'
  AND sent_at < NOW() - INTERVAL '24 hours';

UPDATE communications
SET priority = 'medium',
    email_status = 'waiting_on_customer'
WHERE direction = 'outbound'
  AND sent_at < NOW() - INTERVAL '48 hours';

-- ============================================================================
-- Migration 2: Add Proof Tracking (if not exists)
-- ============================================================================
DO $$
BEGIN
  -- Add revision_count if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'work_items' AND column_name = 'revision_count'
  ) THEN
    ALTER TABLE work_items
      ADD COLUMN revision_count INTEGER DEFAULT 0;
  END IF;

  -- Add proof_sent_at if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'work_items' AND column_name = 'proof_sent_at'
  ) THEN
    ALTER TABLE work_items
      ADD COLUMN proof_sent_at TIMESTAMPTZ;
  END IF;

  -- Add proof_approved_at if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'work_items' AND column_name = 'proof_approved_at'
  ) THEN
    ALTER TABLE work_items
      ADD COLUMN proof_approved_at TIMESTAMPTZ;
  END IF;

  -- Add customer_feedback if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'work_items' AND column_name = 'customer_feedback'
  ) THEN
    ALTER TABLE work_items
      ADD COLUMN customer_feedback TEXT;
  END IF;
END $$;

-- Create indexes if they don't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes WHERE indexname = 'idx_work_items_revision_count'
  ) THEN
    CREATE INDEX idx_work_items_revision_count ON work_items(revision_count)
      WHERE revision_count >= 3;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes WHERE indexname = 'idx_work_items_proof_timeline'
  ) THEN
    CREATE INDEX idx_work_items_proof_timeline ON work_items(proof_sent_at, proof_approved_at);
  END IF;
END $$;

-- Backfill revision_count
UPDATE work_items wi
SET revision_count = COALESCE((
  SELECT COUNT(DISTINCT version) - 1
  FROM files
  WHERE work_item_id = wi.id
    AND kind = 'proof'
    AND version > 0
), 0)
WHERE revision_count = 0;

-- Set proof_sent_at
UPDATE work_items wi
SET proof_sent_at = (
  SELECT MIN(created_at)
  FROM files
  WHERE work_item_id = wi.id
    AND kind = 'proof'
)
WHERE proof_sent_at IS NULL
  AND EXISTS (
    SELECT 1 FROM files
    WHERE work_item_id = wi.id AND kind = 'proof'
  );

-- Set proof_approved_at
UPDATE work_items
SET proof_approved_at = updated_at
WHERE design_review_status = 'approved'
  AND proof_approved_at IS NULL;

-- ============================================================================
-- Migration 3: Add Batch Drip Emails (if not exists)
-- ============================================================================
DO $$
BEGIN
  -- Add alibaba_order_number if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'batches' AND column_name = 'alibaba_order_number'
  ) THEN
    ALTER TABLE batches
      ADD COLUMN alibaba_order_number TEXT;
  END IF;

  -- Add drip email columns if they don't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'batches' AND column_name = 'drip_email_1_sent_at'
  ) THEN
    ALTER TABLE batches
      ADD COLUMN drip_email_1_sent_at TIMESTAMPTZ,
      ADD COLUMN drip_email_2_sent_at TIMESTAMPTZ,
      ADD COLUMN drip_email_3_sent_at TIMESTAMPTZ,
      ADD COLUMN drip_email_4_sent_at TIMESTAMPTZ,
      ADD COLUMN drip_email_4_skipped BOOLEAN DEFAULT false;
  END IF;
END $$;

-- Create indexes if they don't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes WHERE indexname = 'idx_batches_drip_schedule'
  ) THEN
    CREATE INDEX idx_batches_drip_schedule ON batches(
      alibaba_order_number,
      drip_email_1_sent_at,
      drip_email_2_sent_at,
      drip_email_3_sent_at,
      drip_email_4_sent_at
    ) WHERE alibaba_order_number IS NOT NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes WHERE indexname = 'idx_batches_ready_for_email_1'
  ) THEN
    CREATE INDEX idx_batches_ready_for_email_1 ON batches(drip_email_1_sent_at)
      WHERE alibaba_order_number IS NOT NULL AND drip_email_1_sent_at IS NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes WHERE indexname = 'idx_batches_ready_for_email_2'
  ) THEN
    CREATE INDEX idx_batches_ready_for_email_2 ON batches(drip_email_1_sent_at, drip_email_2_sent_at)
      WHERE alibaba_order_number IS NOT NULL
        AND drip_email_1_sent_at IS NOT NULL
        AND drip_email_2_sent_at IS NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes WHERE indexname = 'idx_batches_ready_for_email_3'
  ) THEN
    CREATE INDEX idx_batches_ready_for_email_3 ON batches(drip_email_1_sent_at, drip_email_3_sent_at)
      WHERE alibaba_order_number IS NOT NULL
        AND drip_email_1_sent_at IS NOT NULL
        AND drip_email_3_sent_at IS NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes WHERE indexname = 'idx_batches_ready_for_email_4'
  ) THEN
    CREATE INDEX idx_batches_ready_for_email_4 ON batches(drip_email_1_sent_at, drip_email_4_sent_at, drip_email_4_skipped)
      WHERE alibaba_order_number IS NOT NULL
        AND drip_email_1_sent_at IS NOT NULL
        AND drip_email_4_sent_at IS NULL
        AND drip_email_4_skipped = false;
  END IF;
END $$;

-- Add comments
COMMENT ON COLUMN batches.alibaba_order_number IS 'Alibaba order number - triggers drip email campaign when set';
COMMENT ON COLUMN batches.drip_email_1_sent_at IS 'Timestamp for "Order in production" email (sent immediately when Alibaba # added)';
COMMENT ON COLUMN batches.drip_email_2_sent_at IS 'Timestamp for "Shipped from facility" email (sent 7 days after email 1)';
COMMENT ON COLUMN batches.drip_email_3_sent_at IS 'Timestamp for "Going through customs" email (sent 14 days after email 1)';
COMMENT ON COLUMN batches.drip_email_4_sent_at IS 'Timestamp for "Arrived at warehouse" email (sent 21 days after email 1)';
COMMENT ON COLUMN batches.drip_email_4_skipped IS 'Skip email 4 if Shopify fulfillment webhook already sent tracking email';

-- ============================================================================
-- Done! Now run the email templates migration separately if needed
-- See: 20260227000005_insert_batch_drip_email_templates.sql
-- ============================================================================

SELECT 'PDR v3 Migrations Applied Successfully!' as result;
