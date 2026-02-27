-- Migration: Add Proof Version Control and Timeline Tracking
-- Phase 1: Critical Pain Points - Proof Organization
--
-- This migration adds:
-- 1. revision_count - tracks number of proof revisions (warns at 3+)
-- 2. proof_sent_at - timestamp when proof was sent to customer
-- 3. proof_approved_at - timestamp when customer approved the proof
-- 4. customer_feedback - stores customer comments/feedback on proofs

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
-- Count distinct versions of proof files, subtract 1 to get revision count
-- (v1 = original, v2 = 1st revision, v3 = 2nd revision, etc.)
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

-- Add comment for documentation
COMMENT ON COLUMN work_items.revision_count IS 'Number of proof revisions (excluding original). Show warning at 3+';
COMMENT ON COLUMN work_items.proof_sent_at IS 'Timestamp when first proof was sent to customer';
COMMENT ON COLUMN work_items.proof_approved_at IS 'Timestamp when customer approved the proof';
COMMENT ON COLUMN work_items.customer_feedback IS 'Customer comments and feedback on proof versions';
