-- ============================================================================
-- Migration: Improve Email Deduplication (3-Strategy Approach)
-- Purpose: Support deduplication via provider_message_id, internet_message_id, and fingerprint
-- Created: 2026-02-19
-- ============================================================================

-- 1. RELAX INTERNET_MESSAGE_ID CONSTRAINT
-- ============================================================================
-- Remove the NOT NULL requirement since not all emails have internet_message_id
-- We'll use a 3-strategy approach: provider_message_id OR internet_message_id OR fingerprint
ALTER TABLE communications
DROP CONSTRAINT IF EXISTS chk_internet_message_id_required;

-- Add comment explaining the multi-strategy approach
COMMENT ON COLUMN communications.internet_message_id IS
'Optional RFC 2822 Message-ID header. Used as Strategy #2 for deduplication. May be NULL for some email providers.';

COMMENT ON COLUMN communications.provider_message_id IS
'Provider-specific message ID (e.g., Microsoft Graph message ID). Used as Strategy #1 for deduplication.';

-- 2. ADD UNIQUE CONSTRAINT ON PROVIDER_MESSAGE_ID
-- ============================================================================
-- First, check for any existing duplicates in provider_message_id
DO $$
DECLARE
  duplicate_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO duplicate_count
  FROM (
    SELECT provider_message_id, COUNT(*) as count
    FROM communications
    WHERE provider_message_id IS NOT NULL
    GROUP BY provider_message_id
    HAVING COUNT(*) > 1
  ) duplicates;

  IF duplicate_count > 0 THEN
    RAISE NOTICE 'Found % duplicate groups by provider_message_id. Cleaning up...', duplicate_count;

    -- Delete duplicates, keeping the oldest record
    DELETE FROM communications
    WHERE id IN (
      SELECT c2.id
      FROM communications c1
      INNER JOIN communications c2
        ON c1.provider_message_id = c2.provider_message_id
        AND c1.provider_message_id IS NOT NULL
      WHERE c1.created_at < c2.created_at
        OR (c1.created_at = c2.created_at AND c1.id < c2.id)
    );

    RAISE NOTICE 'Cleaned up provider_message_id duplicates';
  ELSE
    RAISE NOTICE 'No provider_message_id duplicates found';
  END IF;
END $$;

-- Create unique constraint on provider_message_id
ALTER TABLE communications
ADD CONSTRAINT uq_communications_provider_message_id
UNIQUE (provider_message_id);

-- 3. ADD INDEXES FOR FINGERPRINT STRATEGY
-- ============================================================================
-- Strategy #3: Match by (from_email + subject + received_at within 5 seconds)
-- These indexes make the fingerprint lookup fast

-- Index on from_email for first filter
CREATE INDEX IF NOT EXISTS idx_communications_from_email
ON communications(from_email);

-- Index on subject for second filter
CREATE INDEX IF NOT EXISTS idx_communications_subject
ON communications(subject);

-- Index on received_at for time-based queries
CREATE INDEX IF NOT EXISTS idx_communications_received_at
ON communications(received_at);

-- Compound index for fingerprint strategy (most selective first)
CREATE INDEX IF NOT EXISTS idx_communications_fingerprint
ON communications(from_email, subject, received_at)
WHERE from_email IS NOT NULL AND subject IS NOT NULL AND received_at IS NOT NULL;

-- 4. UPDATE MONITORING VIEW
-- ============================================================================
-- Enhance the email_import_health view to include provider_message_id stats
CREATE OR REPLACE VIEW email_import_health AS
SELECT
  COUNT(*) as total_emails,
  COUNT(DISTINCT internet_message_id) as unique_internet_message_ids,
  COUNT(DISTINCT provider_message_id) as unique_provider_message_ids,
  COUNT(*) FILTER (WHERE internet_message_id IS NULL) as missing_internet_message_id,
  COUNT(*) FILTER (WHERE provider_message_id IS NULL) as missing_provider_message_id,
  COUNT(*) FILTER (WHERE internet_message_id IS NULL AND provider_message_id IS NULL) as missing_both_ids,
  COUNT(*) FILTER (WHERE created_at > NOW() - INTERVAL '24 hours') as emails_last_24h,
  COUNT(*) FILTER (WHERE created_at > NOW() - INTERVAL '1 hour') as emails_last_hour,
  COUNT(*) FILTER (WHERE triage_status = 'untriaged') as untriaged_count
FROM communications;

COMMENT ON VIEW email_import_health IS
'Monitoring view for email import health. Tracks deduplication stats across all 3 strategies.';

-- 5. CREATE DUPLICATE DETECTION VIEW
-- ============================================================================
-- View to identify potential duplicates that slipped through
CREATE OR REPLACE VIEW potential_duplicate_emails AS
SELECT
  c1.id as email_1_id,
  c2.id as email_2_id,
  c1.from_email,
  c1.subject,
  c1.received_at as email_1_received_at,
  c2.received_at as email_2_received_at,
  c1.created_at as email_1_created_at,
  c2.created_at as email_2_created_at,
  'fingerprint_match' as match_type
FROM communications c1
INNER JOIN communications c2
  ON c1.from_email = c2.from_email
  AND c1.subject = c2.subject
  AND c1.id < c2.id  -- Prevent duplicate pairs
  AND ABS(EXTRACT(EPOCH FROM (c1.received_at - c2.received_at))) < 10  -- Within 10 seconds
WHERE c1.from_email IS NOT NULL
  AND c1.subject IS NOT NULL
  AND c1.received_at IS NOT NULL;

COMMENT ON VIEW potential_duplicate_emails IS
'Identifies emails that may be duplicates based on fingerprint matching. Use this to audit deduplication effectiveness.';

-- 6. LOG MIGRATION RESULTS
-- ============================================================================
DO $$
DECLARE
  health_stats RECORD;
BEGIN
  SELECT * INTO health_stats FROM email_import_health;

  RAISE NOTICE 'Email Deduplication Migration Complete';
  RAISE NOTICE '=====================================';
  RAISE NOTICE 'Total emails: %', health_stats.total_emails;
  RAISE NOTICE 'Unique internet_message_ids: %', health_stats.unique_internet_message_ids;
  RAISE NOTICE 'Unique provider_message_ids: %', health_stats.unique_provider_message_ids;
  RAISE NOTICE 'Missing internet_message_id: %', health_stats.missing_internet_message_id;
  RAISE NOTICE 'Missing provider_message_id: %', health_stats.missing_provider_message_id;
  RAISE NOTICE 'Missing BOTH IDs: %', health_stats.missing_both_ids;
  RAISE NOTICE '';
  RAISE NOTICE 'Deduplication now uses 3 strategies:';
  RAISE NOTICE '  1. provider_message_id (unique constraint)';
  RAISE NOTICE '  2. internet_message_id (unique constraint)';
  RAISE NOTICE '  3. Fingerprint: from_email + subject + received_at ±5sec (indexed)';
END $$;
