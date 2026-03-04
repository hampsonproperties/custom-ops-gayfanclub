-- ============================================================================
-- Migration: Fix Email Duplicates
-- Purpose: Clean up duplicate emails and improve deduplication constraints
-- Created: 2026-02-03
-- ============================================================================

-- 1. IDENTIFY AND LOG DUPLICATE EMAILS
-- ============================================================================
-- Find duplicate emails (same internet_message_id)
DO $$
DECLARE
  duplicate_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO duplicate_count
  FROM (
    SELECT internet_message_id, COUNT(*) as count
    FROM communications
    WHERE internet_message_id IS NOT NULL
    GROUP BY internet_message_id
    HAVING COUNT(*) > 1
  ) duplicates;

  RAISE NOTICE 'Found % duplicate email groups', duplicate_count;
END $$;

-- 2. CLEAN UP DUPLICATES (Keep oldest, delete newer ones)
-- ============================================================================
-- For each duplicate group, keep the first record (oldest by created_at)
-- and delete the rest
DELETE FROM communications
WHERE id IN (
  SELECT c2.id
  FROM communications c1
  INNER JOIN communications c2
    ON c1.internet_message_id = c2.internet_message_id
    AND c1.internet_message_id IS NOT NULL
  WHERE c1.created_at < c2.created_at  -- c2 is newer than c1
    OR (c1.created_at = c2.created_at AND c1.id < c2.id)  -- tie-breaker using ID
);

-- 3. IMPROVE UNIQUE INDEX (partial — only for imported emails with message IDs)
-- ============================================================================
-- System-generated communications (batch emails, approval emails) don't have
-- internet_message_id, so we use a partial unique index instead of a full constraint.
DROP INDEX IF EXISTS idx_communications_message_id;

CREATE UNIQUE INDEX IF NOT EXISTS idx_communications_unique_message_id
ON communications (internet_message_id)
WHERE internet_message_id IS NOT NULL AND internet_message_id != '';

-- 5. ADD MONITORING VIEW
-- ============================================================================
-- Create a view to monitor for any potential duplicate issues
DROP VIEW IF EXISTS email_import_health;
CREATE VIEW email_import_health AS
SELECT
  COUNT(*) as total_emails,
  COUNT(DISTINCT internet_message_id) as unique_message_ids,
  COUNT(*) - COUNT(DISTINCT internet_message_id) as potential_duplicates,
  COUNT(*) FILTER (WHERE internet_message_id IS NULL) as missing_message_ids,
  COUNT(*) FILTER (WHERE created_at > NOW() - INTERVAL '24 hours') as emails_last_24h,
  COUNT(*) FILTER (WHERE created_at > NOW() - INTERVAL '1 hour') as emails_last_hour
FROM communications;

COMMENT ON VIEW email_import_health IS
'Monitoring view for email import health. Use this to detect duplicate issues or missing message IDs.';

-- Migration complete. Check email_import_health view for stats.
