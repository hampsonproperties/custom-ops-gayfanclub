-- Migration: Add Batch Drip Email Tracking
-- Phase 2: Automation & Discovery - Batch Drip Email Automation
--
-- This migration adds:
-- 1. alibaba_order_number - Tracks Alibaba order for batch
-- 2. drip_email_*_sent_at - Timestamps for each drip email (1-4)
-- 3. drip_email_4_skipped - Flag to skip email 4 if Shopify fulfillment webhook fires
--
-- Email Schedule:
-- - Email 1: "Order in production" (Day 0, when Alibaba # added)
-- - Email 2: "Shipped from facility" (Day 7)
-- - Email 3: "Going through customs" (Day 14)
-- - Email 4: "Arrived at warehouse" (Day 21) - skipped if Shopify fulfillment sent

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
