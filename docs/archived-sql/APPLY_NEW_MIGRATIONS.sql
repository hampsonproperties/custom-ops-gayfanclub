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
-- ============================================================================
-- Migration: Create Dead Letter Queue (DLQ)
-- Purpose: Catch all failed operations, retry with exponential backoff, alert on max retries
-- Created: 2026-02-19
-- ============================================================================

-- 1. CREATE DEAD_LETTER_QUEUE TABLE
-- ============================================================================
CREATE TABLE dead_letter_queue (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

  -- Operation identification
  operation_type TEXT NOT NULL CHECK (operation_type IN (
    'email_import',
    'file_download',
    'file_upload',
    'webhook_processing',
    'email_send',
    'follow_up_calculation',
    'batch_export',
    'shopify_api_call',
    'graph_api_call',
    'other'
  )),
  operation_key TEXT NOT NULL, -- Unique identifier for this operation (e.g., email ID, file path)

  -- Related entities (nullable)
  work_item_id UUID REFERENCES work_items(id) ON DELETE SET NULL,
  customer_id UUID REFERENCES customers(id) ON DELETE SET NULL,
  communication_id UUID REFERENCES communications(id) ON DELETE SET NULL,

  -- Failure details
  error_message TEXT NOT NULL,
  error_code TEXT,
  error_stack TEXT,

  -- Operation context (to enable retry)
  operation_payload JSONB NOT NULL, -- Original input that failed
  operation_metadata JSONB, -- Extra context (user agent, IP, etc.)

  -- Retry tracking
  retry_count INTEGER DEFAULT 0,
  max_retries INTEGER DEFAULT 5,
  next_retry_at TIMESTAMPTZ,
  last_retry_at TIMESTAMPTZ,

  -- Status
  status TEXT DEFAULT 'pending' CHECK (status IN (
    'pending',     -- Waiting for retry
    'retrying',    -- Currently being retried
    'resolved',    -- Successfully retried
    'failed',      -- Max retries exceeded
    'ignored'      -- Manually marked as non-critical
  )),

  -- Resolution
  resolved_at TIMESTAMPTZ,
  resolved_by_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  resolution_note TEXT,

  -- Alerting
  alerted_at TIMESTAMPTZ, -- When Slack alert was sent
  alert_channel TEXT, -- Which Slack channel was notified

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. CREATE INDEXES
-- ============================================================================
CREATE INDEX idx_dlq_status ON dead_letter_queue(status) WHERE status IN ('pending', 'retrying');
CREATE INDEX idx_dlq_next_retry ON dead_letter_queue(next_retry_at) WHERE status = 'pending';
CREATE INDEX idx_dlq_operation_type ON dead_letter_queue(operation_type);
CREATE INDEX idx_dlq_operation_key ON dead_letter_queue(operation_key);
CREATE INDEX idx_dlq_work_item ON dead_letter_queue(work_item_id) WHERE work_item_id IS NOT NULL;
CREATE INDEX idx_dlq_created_at ON dead_letter_queue(created_at DESC);

-- Unique constraint to prevent duplicate entries for the same operation
CREATE UNIQUE INDEX idx_dlq_unique_operation
ON dead_letter_queue(operation_type, operation_key)
WHERE status IN ('pending', 'retrying');

-- 3. CREATE MONITORING VIEW
-- ============================================================================
CREATE OR REPLACE VIEW dlq_health AS
SELECT
  COUNT(*) as total_items,
  COUNT(*) FILTER (WHERE status = 'pending') as pending_count,
  COUNT(*) FILTER (WHERE status = 'retrying') as retrying_count,
  COUNT(*) FILTER (WHERE status = 'failed') as failed_count,
  COUNT(*) FILTER (WHERE status = 'resolved') as resolved_count,
  COUNT(*) FILTER (WHERE status = 'ignored') as ignored_count,
  COUNT(*) FILTER (WHERE status = 'failed' AND alerted_at IS NULL) as needs_alert_count,
  COUNT(*) FILTER (WHERE created_at > NOW() - INTERVAL '24 hours') as items_last_24h,
  COUNT(*) FILTER (WHERE created_at > NOW() - INTERVAL '1 hour') as items_last_hour
FROM dead_letter_queue;

COMMENT ON VIEW dlq_health IS
'Monitoring view for Dead Letter Queue health. Use this to track failure patterns and alert status.';

-- 4. CREATE FAILURE PATTERNS VIEW
-- ============================================================================
CREATE OR REPLACE VIEW dlq_failure_patterns AS
SELECT
  operation_type,
  error_code,
  LEFT(error_message, 100) as error_message_preview,
  COUNT(*) as occurrence_count,
  COUNT(*) FILTER (WHERE status = 'failed') as failed_count,
  COUNT(*) FILTER (WHERE status = 'resolved') as resolved_count,
  MAX(created_at) as last_occurrence,
  MIN(created_at) as first_occurrence
FROM dead_letter_queue
WHERE created_at > NOW() - INTERVAL '7 days'
GROUP BY operation_type, error_code, LEFT(error_message, 100)
ORDER BY occurrence_count DESC
LIMIT 50;

COMMENT ON VIEW dlq_failure_patterns IS
'Identifies common failure patterns in the last 7 days. Use this to prioritize bug fixes.';

-- 5. CREATE FUNCTION TO ADD TO DLQ
-- ============================================================================
CREATE OR REPLACE FUNCTION add_to_dlq(
  p_operation_type TEXT,
  p_operation_key TEXT,
  p_error_message TEXT,
  p_operation_payload JSONB,
  p_error_code TEXT DEFAULT NULL,
  p_error_stack TEXT DEFAULT NULL,
  p_work_item_id UUID DEFAULT NULL,
  p_customer_id UUID DEFAULT NULL,
  p_communication_id UUID DEFAULT NULL,
  p_max_retries INTEGER DEFAULT 5
)
RETURNS UUID
LANGUAGE plpgsql
AS $$
DECLARE
  v_next_retry_at TIMESTAMPTZ;
  v_dlq_id UUID;
BEGIN
  -- Calculate first retry time (5 minutes from now)
  v_next_retry_at := NOW() + INTERVAL '5 minutes';

  -- Insert into DLQ (or update if exists)
  INSERT INTO dead_letter_queue (
    operation_type,
    operation_key,
    error_message,
    error_code,
    error_stack,
    operation_payload,
    work_item_id,
    customer_id,
    communication_id,
    max_retries,
    next_retry_at,
    status
  ) VALUES (
    p_operation_type,
    p_operation_key,
    p_error_message,
    p_error_code,
    p_error_stack,
    p_operation_payload,
    p_work_item_id,
    p_customer_id,
    p_communication_id,
    p_max_retries,
    v_next_retry_at,
    'pending'
  )
  ON CONFLICT (operation_type, operation_key)
  WHERE status IN ('pending', 'retrying')
  DO UPDATE SET
    error_message = EXCLUDED.error_message,
    error_code = EXCLUDED.error_code,
    error_stack = EXCLUDED.error_stack,
    retry_count = dead_letter_queue.retry_count + 1,
    last_retry_at = NOW(),
    next_retry_at = CASE
      -- Exponential backoff: 5min, 15min, 45min, 2h15min, 6h45min
      WHEN dead_letter_queue.retry_count = 0 THEN NOW() + INTERVAL '5 minutes'
      WHEN dead_letter_queue.retry_count = 1 THEN NOW() + INTERVAL '15 minutes'
      WHEN dead_letter_queue.retry_count = 2 THEN NOW() + INTERVAL '45 minutes'
      WHEN dead_letter_queue.retry_count = 3 THEN NOW() + INTERVAL '135 minutes'
      ELSE NOW() + INTERVAL '6 hours 45 minutes'
    END,
    status = CASE
      WHEN dead_letter_queue.retry_count + 1 >= p_max_retries THEN 'failed'
      ELSE 'pending'
    END,
    updated_at = NOW()
  RETURNING id INTO v_dlq_id;

  RETURN v_dlq_id;
END;
$$;

COMMENT ON FUNCTION add_to_dlq IS
'Adds a failed operation to the Dead Letter Queue with exponential backoff retry scheduling.';

-- 6. CREATE FUNCTION TO GET RETRYABLE ITEMS
-- ============================================================================
CREATE OR REPLACE FUNCTION get_retryable_dlq_items(p_limit INTEGER DEFAULT 10)
RETURNS SETOF dead_letter_queue
LANGUAGE sql
STABLE
AS $$
  SELECT *
  FROM dead_letter_queue
  WHERE status = 'pending'
    AND next_retry_at <= NOW()
    AND retry_count < max_retries
  ORDER BY next_retry_at
  LIMIT p_limit;
$$;

COMMENT ON FUNCTION get_retryable_dlq_items IS
'Returns items from DLQ that are ready to retry (pending status, retry time reached, under max retries).';

-- 7. CREATE FUNCTION TO MARK ITEM AS RESOLVED
-- ============================================================================
CREATE OR REPLACE FUNCTION resolve_dlq_item(
  p_dlq_id UUID,
  p_resolution_note TEXT DEFAULT NULL,
  p_resolved_by_user_id UUID DEFAULT NULL
)
RETURNS BOOLEAN
LANGUAGE plpgsql
AS $$
BEGIN
  UPDATE dead_letter_queue
  SET
    status = 'resolved',
    resolved_at = NOW(),
    resolved_by_user_id = p_resolved_by_user_id,
    resolution_note = p_resolution_note,
    updated_at = NOW()
  WHERE id = p_dlq_id;

  RETURN FOUND;
END;
$$;

COMMENT ON FUNCTION resolve_dlq_item IS
'Marks a DLQ item as successfully resolved after retry.';

-- 8. ADD UPDATED_AT TRIGGER
-- ============================================================================
CREATE TRIGGER update_dlq_updated_at
BEFORE UPDATE ON dead_letter_queue
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

-- 9. LOG MIGRATION RESULTS
-- ============================================================================
DO $$
BEGIN
  RAISE NOTICE 'Dead Letter Queue Migration Complete';
  RAISE NOTICE '====================================';
  RAISE NOTICE 'Created tables:';
  RAISE NOTICE '  - dead_letter_queue (with retry logic)';
  RAISE NOTICE '';
  RAISE NOTICE 'Created views:';
  RAISE NOTICE '  - dlq_health (monitoring)';
  RAISE NOTICE '  - dlq_failure_patterns (error analysis)';
  RAISE NOTICE '';
  RAISE NOTICE 'Created functions:';
  RAISE NOTICE '  - add_to_dlq() (add failed operation)';
  RAISE NOTICE '  - get_retryable_dlq_items() (fetch items to retry)';
  RAISE NOTICE '  - resolve_dlq_item() (mark as resolved)';
  RAISE NOTICE '';
  RAISE NOTICE 'Retry schedule (exponential backoff):';
  RAISE NOTICE '  1st retry: +5 minutes';
  RAISE NOTICE '  2nd retry: +15 minutes';
  RAISE NOTICE '  3rd retry: +45 minutes';
  RAISE NOTICE '  4th retry: +2h 15min';
  RAISE NOTICE '  5th retry: +6h 45min';
END $$;
-- ============================================================================
-- Migration: Create Stuck Items Detection Views
-- Purpose: Identify work items that need operator attention
-- Created: 2026-02-19
-- ============================================================================

-- 1. EXPIRED APPROVALS
-- ============================================================================
-- Items awaiting approval where approval link was sent >14 days ago
-- These need manual follow-up or token refresh
CREATE OR REPLACE VIEW stuck_expired_approvals AS
SELECT
  wi.id,
  wi.type,
  wi.title,
  wi.customer_name,
  wi.customer_email,
  wi.status,
  wi.created_at,
  wi.last_contact_at,
  wi.next_follow_up_at,
  EXTRACT(DAYS FROM (NOW() - COALESCE(wi.last_contact_at, wi.created_at))) as days_waiting,
  'expired_approval' as stuck_reason,
  3 as priority_score -- High priority
FROM work_items wi
WHERE wi.status = 'awaiting_approval'
  AND wi.closed_at IS NULL
  AND COALESCE(wi.last_contact_at, wi.created_at) < NOW() - INTERVAL '14 days'
ORDER BY wi.created_at;

COMMENT ON VIEW stuck_expired_approvals IS
'Work items awaiting approval for >14 days. Approval tokens likely expired, need manual follow-up.';

-- 2. OVERDUE INVOICES
-- ============================================================================
-- Items where deposit is paid but full payment not received >30 days
CREATE OR REPLACE VIEW stuck_overdue_invoices AS
SELECT
  wi.id,
  wi.type,
  wi.title,
  wi.customer_name,
  wi.customer_email,
  wi.status,
  wi.shopify_financial_status,
  wi.created_at,
  wi.last_contact_at,
  wi.next_follow_up_at,
  EXTRACT(DAYS FROM (NOW() - wi.created_at)) as days_since_deposit,
  'overdue_invoice' as stuck_reason,
  2 as priority_score -- Medium-high priority
FROM work_items wi
WHERE wi.status IN ('deposit_paid', 'awaiting_balance')
  AND wi.closed_at IS NULL
  AND wi.shopify_financial_status != 'paid'
  AND wi.created_at < NOW() - INTERVAL '30 days'
ORDER BY wi.created_at;

COMMENT ON VIEW stuck_overdue_invoices IS
'Work items with deposit paid but balance overdue >30 days.';

-- 3. FILES NOT RECEIVED
-- ============================================================================
-- Items awaiting files where last contact was >7 days ago
CREATE OR REPLACE VIEW stuck_awaiting_files AS
SELECT
  wi.id,
  wi.type,
  wi.title,
  wi.customer_name,
  wi.customer_email,
  wi.status,
  wi.created_at,
  wi.last_contact_at,
  wi.next_follow_up_at,
  EXTRACT(DAYS FROM (NOW() - COALESCE(wi.last_contact_at, wi.created_at))) as days_waiting,
  'awaiting_files' as stuck_reason,
  2 as priority_score -- Medium-high priority
FROM work_items wi
WHERE wi.status IN ('awaiting_files', 'customer_providing_artwork')
  AND wi.closed_at IS NULL
  AND COALESCE(wi.last_contact_at, wi.created_at) < NOW() - INTERVAL '7 days'
ORDER BY wi.last_contact_at NULLS FIRST, wi.created_at;

COMMENT ON VIEW stuck_awaiting_files IS
'Work items awaiting customer files for >7 days.';

-- 4. DESIGN REVIEW PENDING
-- ============================================================================
-- Items in design_received status but not reviewed >7 days
CREATE OR REPLACE VIEW stuck_design_review AS
SELECT
  wi.id,
  wi.type,
  wi.title,
  wi.customer_name,
  wi.customer_email,
  wi.status,
  wi.design_review_status,
  wi.created_at,
  wi.updated_at,
  EXTRACT(DAYS FROM (NOW() - wi.updated_at)) as days_pending,
  'design_review_pending' as stuck_reason,
  2 as priority_score -- Medium-high priority
FROM work_items wi
WHERE wi.status = 'design_received'
  AND wi.design_review_status = 'pending'
  AND wi.closed_at IS NULL
  AND wi.updated_at < NOW() - INTERVAL '7 days'
ORDER BY wi.updated_at;

COMMENT ON VIEW stuck_design_review IS
'Work items with designs received but not reviewed for >7 days.';

-- 5. MISSING FOLLOW-UP SCHEDULE
-- ============================================================================
-- Open items without next_follow_up_at scheduled
CREATE OR REPLACE VIEW stuck_no_follow_up AS
SELECT
  wi.id,
  wi.type,
  wi.title,
  wi.customer_name,
  wi.customer_email,
  wi.status,
  wi.created_at,
  wi.last_contact_at,
  wi.next_follow_up_at,
  EXTRACT(DAYS FROM (NOW() - COALESCE(wi.updated_at, wi.created_at))) as days_since_update,
  'no_follow_up_scheduled' as stuck_reason,
  1 as priority_score -- Medium priority
FROM work_items wi
WHERE wi.closed_at IS NULL
  AND wi.next_follow_up_at IS NULL
  AND wi.status NOT IN ('shipped', 'cancelled', 'ready_for_batch', 'batched')
  AND wi.created_at < NOW() - INTERVAL '3 days'
ORDER BY wi.created_at;

COMMENT ON VIEW stuck_no_follow_up IS
'Open work items without follow-up scheduled. May be forgotten.';

-- 6. STALE ITEMS (NO ACTIVITY)
-- ============================================================================
-- Items with no updates or communication >14 days
CREATE OR REPLACE VIEW stuck_stale_items AS
SELECT
  wi.id,
  wi.type,
  wi.title,
  wi.customer_name,
  wi.customer_email,
  wi.status,
  wi.created_at,
  wi.last_contact_at,
  wi.updated_at,
  EXTRACT(DAYS FROM (NOW() - GREATEST(
    COALESCE(wi.last_contact_at, wi.created_at),
    wi.updated_at
  ))) as days_stale,
  'stale_no_activity' as stuck_reason,
  1 as priority_score -- Medium priority
FROM work_items wi
WHERE wi.closed_at IS NULL
  AND wi.status NOT IN ('shipped', 'cancelled')
  AND GREATEST(
    COALESCE(wi.last_contact_at, wi.created_at),
    wi.updated_at
  ) < NOW() - INTERVAL '14 days'
ORDER BY GREATEST(
  COALESCE(wi.last_contact_at, wi.created_at),
  wi.updated_at
);

COMMENT ON VIEW stuck_stale_items IS
'Work items with no activity (updates or communication) for >14 days.';

-- 7. DLQ FAILED ITEMS
-- ============================================================================
-- Operations that failed max retries and need manual intervention
CREATE OR REPLACE VIEW stuck_dlq_failures AS
SELECT
  dlq.id,
  dlq.operation_type,
  dlq.operation_key,
  dlq.work_item_id,
  dlq.error_message,
  dlq.retry_count,
  dlq.created_at,
  dlq.last_retry_at,
  EXTRACT(DAYS FROM (NOW() - dlq.created_at)) as days_failed,
  'dlq_max_retries' as stuck_reason,
  3 as priority_score -- High priority
FROM dead_letter_queue dlq
WHERE dlq.status = 'failed'
  AND dlq.alerted_at IS NULL -- Not yet alerted
ORDER BY dlq.created_at;

COMMENT ON VIEW stuck_dlq_failures IS
'Dead Letter Queue items that exceeded max retries and need manual intervention.';

-- 8. UNIFIED STUCK ITEMS DASHBOARD
-- ============================================================================
-- Combines all stuck item types into a single dashboard view
CREATE OR REPLACE VIEW stuck_items_dashboard AS
-- Expired approvals
SELECT
  id as work_item_id,
  NULL::uuid as dlq_id,
  type as item_type,
  title,
  customer_name,
  customer_email,
  status,
  stuck_reason,
  priority_score,
  days_waiting::integer as days_stuck,
  created_at,
  last_contact_at,
  next_follow_up_at
FROM stuck_expired_approvals

UNION ALL

-- Overdue invoices
SELECT
  id,
  NULL::uuid,
  type,
  title,
  customer_name,
  customer_email,
  status,
  stuck_reason,
  priority_score,
  days_since_deposit::integer,
  created_at,
  last_contact_at,
  next_follow_up_at
FROM stuck_overdue_invoices

UNION ALL

-- Awaiting files
SELECT
  id,
  NULL::uuid,
  type,
  title,
  customer_name,
  customer_email,
  status,
  stuck_reason,
  priority_score,
  days_waiting::integer,
  created_at,
  last_contact_at,
  next_follow_up_at
FROM stuck_awaiting_files

UNION ALL

-- Design review pending
SELECT
  id,
  NULL::uuid,
  type,
  title,
  customer_name,
  customer_email,
  status,
  stuck_reason,
  priority_score,
  days_pending::integer,
  created_at,
  NULL::timestamptz,
  next_follow_up_at
FROM stuck_design_review

UNION ALL

-- No follow-up scheduled
SELECT
  id,
  NULL::uuid,
  type,
  title,
  customer_name,
  customer_email,
  status,
  stuck_reason,
  priority_score,
  days_since_update::integer,
  created_at,
  last_contact_at,
  next_follow_up_at
FROM stuck_no_follow_up

UNION ALL

-- Stale items
SELECT
  id,
  NULL::uuid,
  type,
  title,
  customer_name,
  customer_email,
  status,
  stuck_reason,
  priority_score,
  days_stale::integer,
  created_at,
  last_contact_at,
  next_follow_up_at
FROM stuck_stale_items

UNION ALL

-- DLQ failures (with work_item_id)
SELECT
  work_item_id,
  id,
  operation_type::text,
  operation_key,
  NULL::text,
  NULL::text,
  'dlq_failure',
  stuck_reason,
  priority_score,
  days_failed::integer,
  created_at,
  last_retry_at,
  NULL::timestamptz
FROM stuck_dlq_failures
WHERE work_item_id IS NOT NULL

ORDER BY priority_score DESC, days_stuck DESC;

COMMENT ON VIEW stuck_items_dashboard IS
'Unified dashboard of all stuck items across all categories. Ordered by priority and age.';

-- 9. STUCK ITEMS SUMMARY
-- ============================================================================
-- Summary statistics for dashboard header
CREATE OR REPLACE VIEW stuck_items_summary AS
SELECT
  (SELECT COUNT(*) FROM stuck_expired_approvals) as expired_approvals_count,
  (SELECT COUNT(*) FROM stuck_overdue_invoices) as overdue_invoices_count,
  (SELECT COUNT(*) FROM stuck_awaiting_files) as awaiting_files_count,
  (SELECT COUNT(*) FROM stuck_design_review) as design_review_count,
  (SELECT COUNT(*) FROM stuck_no_follow_up) as no_follow_up_count,
  (SELECT COUNT(*) FROM stuck_stale_items) as stale_items_count,
  (SELECT COUNT(*) FROM stuck_dlq_failures) as dlq_failures_count,
  (
    (SELECT COUNT(*) FROM stuck_expired_approvals) +
    (SELECT COUNT(*) FROM stuck_overdue_invoices) +
    (SELECT COUNT(*) FROM stuck_awaiting_files) +
    (SELECT COUNT(*) FROM stuck_design_review) +
    (SELECT COUNT(*) FROM stuck_no_follow_up) +
    (SELECT COUNT(*) FROM stuck_stale_items) +
    (SELECT COUNT(*) FROM stuck_dlq_failures)
  ) as total_stuck_items;

COMMENT ON VIEW stuck_items_summary IS
'Summary counts for stuck items dashboard header.';

-- 10. LOG MIGRATION RESULTS
-- ============================================================================
DO $$
DECLARE
  summary_stats RECORD;
BEGIN
  SELECT * INTO summary_stats FROM stuck_items_summary;

  RAISE NOTICE 'Stuck Items Detection Views Created';
  RAISE NOTICE '====================================';
  RAISE NOTICE 'Current Stuck Items:';
  RAISE NOTICE '  Expired approvals: %', summary_stats.expired_approvals_count;
  RAISE NOTICE '  Overdue invoices: %', summary_stats.overdue_invoices_count;
  RAISE NOTICE '  Awaiting files: %', summary_stats.awaiting_files_count;
  RAISE NOTICE '  Design review pending: %', summary_stats.design_review_count;
  RAISE NOTICE '  No follow-up scheduled: %', summary_stats.no_follow_up_count;
  RAISE NOTICE '  Stale items: %', summary_stats.stale_items_count;
  RAISE NOTICE '  DLQ failures: %', summary_stats.dlq_failures_count;
  RAISE NOTICE '  ----------------';
  RAISE NOTICE '  TOTAL: %', summary_stats.total_stuck_items;
  RAISE NOTICE '';
  RAISE NOTICE 'Views created:';
  RAISE NOTICE '  - stuck_expired_approvals';
  RAISE NOTICE '  - stuck_overdue_invoices';
  RAISE NOTICE '  - stuck_awaiting_files';
  RAISE NOTICE '  - stuck_design_review';
  RAISE NOTICE '  - stuck_no_follow_up';
  RAISE NOTICE '  - stuck_stale_items';
  RAISE NOTICE '  - stuck_dlq_failures';
  RAISE NOTICE '  - stuck_items_dashboard (unified)';
  RAISE NOTICE '  - stuck_items_summary (counts)';
END $$;
-- ============================================================================
-- Migration: Create Email Filters for Domain-Based Categorization
-- Purpose: Replace keyword-based categorization with domain allow/block lists
-- Created: 2026-02-19
-- ============================================================================

-- 1. CREATE EMAIL_FILTERS TABLE
-- ============================================================================
CREATE TABLE email_filters (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

  -- Filter configuration
  filter_type TEXT NOT NULL CHECK (filter_type IN ('domain', 'sender', 'subject_keyword')),
  pattern TEXT NOT NULL, -- Domain (e.g. '@loreal.com'), email, or keyword
  action TEXT NOT NULL CHECK (action IN ('categorize', 'block', 'prioritize')),
  target_category TEXT, -- Where to categorize (e.g. 'primary', 'other', 'spam')

  -- Metadata
  name TEXT NOT NULL,
  description TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  priority INTEGER DEFAULT 100, -- Lower = higher priority

  -- Stats
  match_count INTEGER DEFAULT 0,
  last_matched_at TIMESTAMPTZ,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_email_filters_active ON email_filters(is_active) WHERE is_active = TRUE;
CREATE INDEX idx_email_filters_type ON email_filters(filter_type);
CREATE INDEX idx_email_filters_priority ON email_filters(priority);

-- 2. SEED DEFAULT FILTERS
-- ============================================================================

-- Known spam domains (block)
INSERT INTO email_filters (filter_type, pattern, action, target_category, name, description, priority) VALUES
  ('domain', '@360onlineprint.com', 'categorize', 'spam', 'Block 360onlineprint spam', 'Marketing spam from 360onlineprint', 10),
  ('domain', '@mailchimp.com', 'categorize', 'other', 'Auto-archive Mailchimp', 'Mailchimp marketing emails', 20),
  ('domain', '@shopify.com', 'categorize', 'other', 'Shopify notifications', 'Order confirmations and updates', 30),
  ('domain', '@noreply', 'categorize', 'other', 'No-reply senders', 'Automated notifications', 40),
  ('domain', '@no-reply', 'categorize', 'other', 'No-reply senders (hyphen)', 'Automated notifications', 40);

-- Known customer domains (prioritize and categorize as primary)
INSERT INTO email_filters (filter_type, pattern, action, target_category, name, description, priority) VALUES
  ('domain', '@loreal.com', 'categorize', 'primary', 'L\'Oreal customer emails', 'Enterprise customer - high priority', 5),
  ('domain', '@luxottica.com', 'categorize', 'primary', 'Luxottica customer emails', 'Enterprise customer', 5),
  ('domain', '@ritzcarltoncruise.com', 'categorize', 'primary', 'Ritz Carlton customer emails', 'VIP customer', 5);

-- Form providers (keep as primary even if from no-reply)
INSERT INTO email_filters (filter_type, pattern, action, target_category, name, description, priority) VALUES
  ('domain', '@powerfulform.com', 'categorize', 'primary', 'PowerfulForm submissions', 'New lead form submissions', 1),
  ('sender', 'forms-noreply@google.com', 'categorize', 'primary', 'Google Forms submissions', 'New lead form submissions', 1),
  ('domain', '@formstack.com', 'categorize', 'primary', 'Formstack submissions', 'New lead form submissions', 1),
  ('domain', '@typeform.com', 'categorize', 'primary', 'Typeform submissions', 'New lead form submissions', 1),
  ('domain', '@jotform.com', 'categorize', 'primary', 'Jotform submissions', 'New lead form submissions', 1);

-- Support-related subject keywords (categorize as support)
INSERT INTO email_filters (filter_type, pattern, action, target_category, name, description, priority) VALUES
  ('subject_keyword', 'missing', 'categorize', 'support', 'Missing items', 'Customer reporting missing items', 50),
  ('subject_keyword', 'damaged', 'categorize', 'support', 'Damaged items', 'Customer reporting damaged items', 50),
  ('subject_keyword', 'refund', 'categorize', 'support', 'Refund requests', 'Customer requesting refund', 50),
  ('subject_keyword', 'wrong', 'categorize', 'support', 'Wrong items', 'Customer received wrong items', 50),
  ('subject_keyword', 'problem', 'categorize', 'support', 'Problems', 'General problem reports', 60),
  ('subject_keyword', 'issue', 'categorize', 'support', 'Issues', 'General issue reports', 60);

-- 3. CREATE FUNCTION TO APPLY EMAIL FILTERS
-- ============================================================================
CREATE OR REPLACE FUNCTION apply_email_filters(
  p_from_email TEXT,
  p_subject TEXT DEFAULT NULL
)
RETURNS TABLE (
  matched_category TEXT,
  filter_id UUID
)
LANGUAGE plpgsql
AS $$
DECLARE
  v_filter RECORD;
BEGIN
  -- Apply filters in priority order (lower = higher priority)
  FOR v_filter IN
    SELECT *
    FROM email_filters
    WHERE is_active = TRUE
    ORDER BY priority ASC, created_at ASC
  LOOP
    -- Check domain filters
    IF v_filter.filter_type = 'domain' THEN
      IF p_from_email ILIKE '%' || v_filter.pattern THEN
        -- Update match stats
        UPDATE email_filters
        SET
          match_count = match_count + 1,
          last_matched_at = NOW()
        WHERE id = v_filter.id;

        RETURN QUERY SELECT v_filter.target_category, v_filter.id;
        RETURN;
      END IF;
    END IF;

    -- Check sender filters (exact match)
    IF v_filter.filter_type = 'sender' THEN
      IF LOWER(p_from_email) = LOWER(v_filter.pattern) THEN
        UPDATE email_filters
        SET
          match_count = match_count + 1,
          last_matched_at = NOW()
        WHERE id = v_filter.id;

        RETURN QUERY SELECT v_filter.target_category, v_filter.id;
        RETURN;
      END IF;
    END IF;

    -- Check subject keyword filters (case-insensitive)
    IF v_filter.filter_type = 'subject_keyword' AND p_subject IS NOT NULL THEN
      IF p_subject ILIKE '%' || v_filter.pattern || '%' THEN
        UPDATE email_filters
        SET
          match_count = match_count + 1,
          last_matched_at = NOW()
        WHERE id = v_filter.id;

        RETURN QUERY SELECT v_filter.target_category, v_filter.id;
        RETURN;
      END IF;
    END IF;
  END LOOP;

  -- No filter matched, return NULL
  RETURN;
END;
$$;

COMMENT ON FUNCTION apply_email_filters IS
'Applies email filters in priority order. Returns the first matching filter''s category and ID.';

-- 4. CREATE EMAIL FILTER STATS VIEW
-- ============================================================================
CREATE OR REPLACE VIEW email_filter_stats AS
SELECT
  ef.id,
  ef.name,
  ef.filter_type,
  ef.pattern,
  ef.target_category,
  ef.match_count,
  ef.last_matched_at,
  ef.is_active,
  ef.priority
FROM email_filters ef
ORDER BY ef.match_count DESC;

COMMENT ON VIEW email_filter_stats IS
'Statistics for email filters showing which filters are matching most often.';

-- 5. ADD UPDATED_AT TRIGGER
-- ============================================================================
CREATE TRIGGER update_email_filters_updated_at
BEFORE UPDATE ON email_filters
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

-- 6. LOG MIGRATION RESULTS
-- ============================================================================
DO $$
DECLARE
  filter_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO filter_count FROM email_filters;

  RAISE NOTICE 'Email Filters Migration Complete';
  RAISE NOTICE '===================================';
  RAISE NOTICE 'Created table: email_filters';
  RAISE NOTICE 'Created function: apply_email_filters()';
  RAISE NOTICE 'Created view: email_filter_stats';
  RAISE NOTICE '';
  RAISE NOTICE 'Seeded % default filters:', filter_count;
  RAISE NOTICE '  - Spam domains (360onlineprint, etc.)';
  RAISE NOTICE '  - Enterprise customers (L''Oreal, Luxottica, etc.)';
  RAISE NOTICE '  - Form providers (PowerfulForm, Google Forms, etc.)';
  RAISE NOTICE '  - Support keywords (missing, damaged, refund, etc.)';
  RAISE NOTICE '';
  RAISE NOTICE 'Email categorization now uses:';
  RAISE NOTICE '  1. Domain-based filtering (priority 1-50)';
  RAISE NOTICE '  2. Sender-based filtering';
  RAISE NOTICE '  3. Subject keyword filtering (priority 50-100)';
  RAISE NOTICE '  4. Fallback to "primary" if no match';
END $$;
-- ============================================================================
-- Migration: Create Conversations Table (CRM Model)
-- Purpose: Implement Customer → Projects → Conversations → Messages structure
-- Created: 2026-02-19
-- ============================================================================

-- 1. CREATE CONVERSATIONS TABLE
-- ============================================================================
CREATE TABLE conversations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

  -- Relationships
  customer_id UUID REFERENCES customers(id) ON DELETE SET NULL,
  work_item_id UUID REFERENCES work_items(id) ON DELETE SET NULL,

  -- Thread identification
  provider TEXT DEFAULT 'm365' CHECK (provider IN ('m365', 'gmail', 'other')),
  provider_thread_id TEXT, -- Microsoft Graph conversationId

  -- Conversation metadata
  subject TEXT NOT NULL,

  -- Status
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'resolved', 'archived')),

  -- Stats
  message_count INTEGER DEFAULT 0,
  last_message_at TIMESTAMPTZ,
  last_message_from TEXT, -- Email address of last sender
  last_message_direction TEXT CHECK (last_message_direction IN ('inbound', 'outbound')),

  -- Flags
  has_unread BOOLEAN DEFAULT FALSE,
  is_important BOOLEAN DEFAULT FALSE,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. CREATE INDEXES
-- ============================================================================
CREATE INDEX idx_conversations_customer ON conversations(customer_id);
CREATE INDEX idx_conversations_work_item ON conversations(work_item_id);
CREATE INDEX idx_conversations_thread_id ON conversations(provider_thread_id) WHERE provider_thread_id IS NOT NULL;
CREATE INDEX idx_conversations_status ON conversations(status);
CREATE INDEX idx_conversations_last_message ON conversations(last_message_at DESC);
CREATE INDEX idx_conversations_unread ON conversations(has_unread) WHERE has_unread = TRUE;

-- Unique constraint on provider_thread_id (one conversation per thread)
CREATE UNIQUE INDEX idx_conversations_unique_thread
ON conversations(provider, provider_thread_id)
WHERE provider_thread_id IS NOT NULL;

-- 3. ADD conversation_id TO communications TABLE
-- ============================================================================
ALTER TABLE communications
ADD COLUMN conversation_id UUID REFERENCES conversations(id) ON DELETE SET NULL;

CREATE INDEX idx_communications_conversation ON communications(conversation_id);

-- 4. CREATE FUNCTION TO FIND OR CREATE CONVERSATION
-- ============================================================================
CREATE OR REPLACE FUNCTION find_or_create_conversation(
  p_provider TEXT,
  p_provider_thread_id TEXT,
  p_subject TEXT,
  p_customer_id UUID DEFAULT NULL,
  p_work_item_id UUID DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
AS $$
DECLARE
  v_conversation_id UUID;
BEGIN
  -- Try to find existing conversation by thread ID
  IF p_provider_thread_id IS NOT NULL THEN
    SELECT id INTO v_conversation_id
    FROM conversations
    WHERE provider = p_provider
      AND provider_thread_id = p_provider_thread_id;

    IF FOUND THEN
      RETURN v_conversation_id;
    END IF;
  END IF;

  -- Create new conversation
  INSERT INTO conversations (
    provider,
    provider_thread_id,
    subject,
    customer_id,
    work_item_id,
    status,
    message_count,
    last_message_at
  ) VALUES (
    p_provider,
    p_provider_thread_id,
    p_subject,
    p_customer_id,
    p_work_item_id,
    'active',
    0,
    NOW()
  )
  RETURNING id INTO v_conversation_id;

  RETURN v_conversation_id;
END;
$$;

COMMENT ON FUNCTION find_or_create_conversation IS
'Finds existing conversation by thread ID or creates a new one.';

-- 5. CREATE FUNCTION TO UPDATE CONVERSATION STATS
-- ============================================================================
CREATE OR REPLACE FUNCTION update_conversation_stats(
  p_conversation_id UUID,
  p_message_direction TEXT,
  p_message_from TEXT,
  p_received_at TIMESTAMPTZ
)
RETURNS VOID
LANGUAGE plpgsql
AS $$
BEGIN
  UPDATE conversations
  SET
    message_count = message_count + 1,
    last_message_at = p_received_at,
    last_message_from = p_message_from,
    last_message_direction = p_message_direction,
    has_unread = CASE
      WHEN p_message_direction = 'inbound' THEN TRUE
      ELSE has_unread
    END,
    updated_at = NOW()
  WHERE id = p_conversation_id;
END;
$$;

COMMENT ON FUNCTION update_conversation_stats IS
'Updates conversation stats when a new message is added.';

-- 6. CREATE TRIGGER TO AUTO-UPDATE CONVERSATION STATS
-- ============================================================================
CREATE OR REPLACE FUNCTION trigger_update_conversation_stats()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  -- Only update if conversation_id is set
  IF NEW.conversation_id IS NOT NULL THEN
    PERFORM update_conversation_stats(
      NEW.conversation_id,
      NEW.direction,
      NEW.from_email,
      NEW.received_at
    );
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER communications_update_conversation
AFTER INSERT ON communications
FOR EACH ROW
EXECUTE FUNCTION trigger_update_conversation_stats();

-- 7. BACKFILL EXISTING COMMUNICATIONS INTO CONVERSATIONS
-- ============================================================================
-- Group existing communications by thread ID and create conversations
DO $$
DECLARE
  v_thread RECORD;
  v_conversation_id UUID;
  v_customer_id UUID;
  v_work_item_id UUID;
  v_thread_count INTEGER := 0;
BEGIN
  RAISE NOTICE 'Backfilling conversations from existing communications...';

  -- Process each unique thread
  FOR v_thread IN
    SELECT DISTINCT
      provider,
      provider_thread_id,
      subject,
      work_item_id,
      customer_id,
      MIN(received_at) as first_message_at,
      COUNT(*) as message_count
    FROM communications
    WHERE provider_thread_id IS NOT NULL
    GROUP BY provider, provider_thread_id, subject, work_item_id, customer_id
  LOOP
    -- Create conversation
    INSERT INTO conversations (
      provider,
      provider_thread_id,
      subject,
      customer_id,
      work_item_id,
      status,
      message_count,
      last_message_at
    )
    VALUES (
      v_thread.provider,
      v_thread.provider_thread_id,
      v_thread.subject,
      v_thread.customer_id,
      v_thread.work_item_id,
      'active',
      0, -- Will be updated by trigger
      v_thread.first_message_at
    )
    ON CONFLICT (provider, provider_thread_id) DO NOTHING
    RETURNING id INTO v_conversation_id;

    IF v_conversation_id IS NOT NULL THEN
      -- Link communications to this conversation
      UPDATE communications
      SET conversation_id = v_conversation_id
      WHERE provider = v_thread.provider
        AND provider_thread_id = v_thread.provider_thread_id;

      v_thread_count := v_thread_count + 1;
    END IF;
  END LOOP;

  RAISE NOTICE 'Backfilled % conversations', v_thread_count;

  -- Update conversation stats for all backfilled conversations
  UPDATE conversations c
  SET
    message_count = (
      SELECT COUNT(*)
      FROM communications
      WHERE conversation_id = c.id
    ),
    last_message_at = (
      SELECT MAX(received_at)
      FROM communications
      WHERE conversation_id = c.id
    ),
    last_message_from = (
      SELECT from_email
      FROM communications
      WHERE conversation_id = c.id
      ORDER BY received_at DESC
      LIMIT 1
    ),
    last_message_direction = (
      SELECT direction
      FROM communications
      WHERE conversation_id = c.id
      ORDER BY received_at DESC
      LIMIT 1
    );

  RAISE NOTICE 'Updated stats for all conversations';
END $$;

-- 8. CREATE CONVERSATION VIEWS
-- ============================================================================

-- Active conversations by customer
CREATE OR REPLACE VIEW customer_conversations AS
SELECT
  c.id as conversation_id,
  c.customer_id,
  cust.email as customer_email,
  cust.display_name as customer_name,
  c.work_item_id,
  wi.title as work_item_title,
  wi.status as work_item_status,
  c.subject,
  c.message_count,
  c.last_message_at,
  c.last_message_from,
  c.last_message_direction,
  c.has_unread,
  c.status as conversation_status,
  c.created_at
FROM conversations c
LEFT JOIN customers cust ON c.customer_id = cust.id
LEFT JOIN work_items wi ON c.work_item_id = wi.id
WHERE c.status = 'active'
ORDER BY c.last_message_at DESC;

COMMENT ON VIEW customer_conversations IS
'Active conversations with customer and work item details.';

-- Unread conversations
CREATE OR REPLACE VIEW unread_conversations AS
SELECT
  c.id as conversation_id,
  c.customer_id,
  cust.display_name as customer_name,
  cust.email as customer_email,
  c.subject,
  c.message_count,
  c.last_message_at,
  EXTRACT(HOURS FROM (NOW() - c.last_message_at)) as hours_since_last_message
FROM conversations c
LEFT JOIN customers cust ON c.customer_id = cust.id
WHERE c.has_unread = TRUE
  AND c.status = 'active'
ORDER BY c.last_message_at DESC;

COMMENT ON VIEW unread_conversations IS
'Conversations with unread inbound messages.';

-- 9. ADD UPDATED_AT TRIGGER
-- ============================================================================
CREATE TRIGGER update_conversations_updated_at
BEFORE UPDATE ON conversations
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

-- 10. LOG MIGRATION RESULTS
-- ============================================================================
DO $$
DECLARE
  conversation_count INTEGER;
  thread_count INTEGER;
  orphan_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO conversation_count FROM conversations;
  SELECT COUNT(DISTINCT provider_thread_id) INTO thread_count
  FROM communications
  WHERE provider_thread_id IS NOT NULL;

  SELECT COUNT(*) INTO orphan_count
  FROM communications
  WHERE conversation_id IS NULL
    AND provider_thread_id IS NOT NULL;

  RAISE NOTICE 'Conversations Table Migration Complete';
  RAISE NOTICE '======================================';
  RAISE NOTICE 'Created conversations table';
  RAISE NOTICE 'Added conversation_id to communications';
  RAISE NOTICE '';
  RAISE NOTICE 'Backfill Results:';
  RAISE NOTICE '  Total conversations created: %', conversation_count;
  RAISE NOTICE '  Unique threads processed: %', thread_count;
  RAISE NOTICE '  Orphaned communications: %', orphan_count;
  RAISE NOTICE '';
  RAISE NOTICE 'Created functions:';
  RAISE NOTICE '  - find_or_create_conversation()';
  RAISE NOTICE '  - update_conversation_stats()';
  RAISE NOTICE '';
  RAISE NOTICE 'Created views:';
  RAISE NOTICE '  - customer_conversations';
  RAISE NOTICE '  - unread_conversations';
  RAISE NOTICE '';
  RAISE NOTICE 'CRM Model: Customer → Work Items → Conversations → Messages';
END $$;
-- ============================================================================
-- Migration: Create Auto-Reminder Engine
-- Purpose: Automated follow-ups for expiring approvals, overdue payments, missing files
-- Created: 2026-02-19
-- ============================================================================

-- 1. CREATE REMINDER_TEMPLATES TABLE
-- ============================================================================
CREATE TABLE reminder_templates (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

  -- Template identification
  key TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  description TEXT,

  -- Trigger conditions
  trigger_type TEXT NOT NULL CHECK (trigger_type IN (
    'approval_expiring',      -- Approval link expiring in X days
    'payment_overdue',         -- Payment overdue for X days
    'files_not_received',      -- Files not received after X days
    'design_review_pending',   -- Design not reviewed after X days
    'follow_up_overdue',       -- Follow-up date passed
    'stale_item'              -- No activity for X days
  )),
  trigger_days INTEGER NOT NULL, -- Number of days before/after to trigger

  -- Email content
  subject_template TEXT NOT NULL,
  body_html_template TEXT NOT NULL,
  merge_fields TEXT[], -- Available: {{customer_name}}, {{work_item_title}}, etc.

  -- Configuration
  is_active BOOLEAN DEFAULT TRUE,
  send_to_customer BOOLEAN DEFAULT TRUE,
  send_to_operator BOOLEAN DEFAULT FALSE,
  operator_email TEXT,

  -- Stats
  sent_count INTEGER DEFAULT 0,
  last_sent_at TIMESTAMPTZ,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_reminder_templates_trigger ON reminder_templates(trigger_type);
CREATE INDEX idx_reminder_templates_active ON reminder_templates(is_active) WHERE is_active = TRUE;

-- 2. CREATE REMINDER_QUEUE TABLE
-- ============================================================================
CREATE TABLE reminder_queue (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

  -- References
  work_item_id UUID NOT NULL REFERENCES work_items(id) ON DELETE CASCADE,
  reminder_template_id UUID NOT NULL REFERENCES reminder_templates(id) ON DELETE CASCADE,

  -- Schedule
  scheduled_for TIMESTAMPTZ NOT NULL,
  sent_at TIMESTAMPTZ,

  -- Status
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'failed', 'cancelled')),

  -- Error tracking
  error_message TEXT,
  retry_count INTEGER DEFAULT 0,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_reminder_queue_scheduled ON reminder_queue(scheduled_for) WHERE status = 'pending';
CREATE INDEX idx_reminder_queue_work_item ON reminder_queue(work_item_id);
CREATE INDEX idx_reminder_queue_status ON reminder_queue(status);

-- 3. SEED DEFAULT REMINDER TEMPLATES
-- ============================================================================

-- Approval expiring in 2 days
INSERT INTO reminder_templates (
  key,
  name,
  description,
  trigger_type,
  trigger_days,
  subject_template,
  body_html_template,
  merge_fields,
  send_to_customer,
  send_to_operator
) VALUES (
  'approval_expiring_2d',
  'Approval Expiring in 2 Days',
  'Remind customer their approval link expires in 2 days',
  'approval_expiring',
  2,
  'Reminder: Your design approval for {{work_item_title}} expires in 2 days',
  '<p>Hi {{customer_name}},</p>
<p>This is a friendly reminder that your design approval link will expire in <strong>2 days</strong>.</p>
<p>Please review and approve your design as soon as possible to keep your order on schedule.</p>
<p><strong>Order:</strong> {{work_item_title}}</p>
<p>If you need a new approval link, just reply to this email.</p>
<p>Thank you!</p>
<p>The Gay Fan Club Team</p>',
  ARRAY['customer_name', 'work_item_title', 'approval_url', 'event_date'],
  TRUE,
  FALSE
);

-- Payment overdue 7 days
INSERT INTO reminder_templates (
  key,
  name,
  description,
  trigger_type,
  trigger_days,
  subject_template,
  body_html_template,
  merge_fields,
  send_to_customer,
  send_to_operator
) VALUES (
  'payment_overdue_7d',
  'Payment Overdue - 7 Days',
  'Remind customer their balance payment is overdue',
  'payment_overdue',
  7,
  'Payment Reminder: Balance due for {{work_item_title}}',
  '<p>Hi {{customer_name}},</p>
<p>We noticed the balance payment for your order is now overdue.</p>
<p><strong>Order:</strong> {{work_item_title}}<br>
<strong>Amount Due:</strong> {{balance_amount}}</p>
<p>To keep your order on schedule, please submit your payment as soon as possible.</p>
<p>If you have any questions about payment, please reply to this email or give us a call.</p>
<p>Thank you!</p>
<p>The Gay Fan Club Team</p>',
  ARRAY['customer_name', 'work_item_title', 'balance_amount', 'payment_url'],
  TRUE,
  TRUE
);

-- Files not received after 7 days
INSERT INTO reminder_templates (
  key,
  name,
  description,
  trigger_type,
  trigger_days,
  subject_template,
  body_html_template,
  merge_fields,
  send_to_customer,
  send_to_operator
) VALUES (
  'files_not_received_7d',
  'Files Not Received - 7 Days',
  'Remind customer to send their artwork/files',
  'files_not_received',
  7,
  'Reminder: We\'re waiting for your files for {{work_item_title}}',
  '<p>Hi {{customer_name}},</p>
<p>We\'re still waiting to receive your artwork files for:</p>
<p><strong>Order:</strong> {{work_item_title}}</p>
<p>To keep your order on schedule, please upload your files as soon as possible.</p>
<p>If you need help with file formats or have any questions, just reply to this email.</p>
<p>Thank you!</p>
<p>The Gay Fan Club Team</p>',
  ARRAY['customer_name', 'work_item_title', 'upload_url'],
  TRUE,
  FALSE
);

-- Design review pending 3 days
INSERT INTO reminder_templates (
  key,
  name,
  description,
  trigger_type,
  trigger_days,
  subject_template,
  body_html_template,
  merge_fields,
  send_to_customer,
  send_to_operator
) VALUES (
  'design_review_pending_3d',
  'Design Review Pending - Internal Alert',
  'Alert operator that design needs review',
  'design_review_pending',
  3,
  '[INTERNAL] Design Review Needed: {{work_item_title}}',
  '<p>A design has been pending review for 3 days:</p>
<p><strong>Order:</strong> {{work_item_title}}<br>
<strong>Customer:</strong> {{customer_name}}</p>
<p>Please review the design to keep the order on schedule.</p>',
  ARRAY['work_item_title', 'customer_name', 'work_item_url'],
  FALSE,
  TRUE
);

-- 4. CREATE FUNCTION TO GENERATE REMINDERS
-- ============================================================================
CREATE OR REPLACE FUNCTION generate_reminders()
RETURNS TABLE (
  work_item_id UUID,
  template_key TEXT,
  scheduled_for TIMESTAMPTZ
)
LANGUAGE plpgsql
AS $$
BEGIN
  -- Approval expiring reminders
  RETURN QUERY
  INSERT INTO reminder_queue (work_item_id, reminder_template_id, scheduled_for)
  SELECT
    wi.id,
    rt.id,
    wi.last_contact_at + INTERVAL '12 days' -- Send reminder 2 days before 14-day expiration
  FROM work_items wi
  CROSS JOIN reminder_templates rt
  WHERE wi.status = 'awaiting_approval'
    AND wi.closed_at IS NULL
    AND rt.trigger_type = 'approval_expiring'
    AND rt.is_active = TRUE
    AND wi.last_contact_at IS NOT NULL
    AND wi.last_contact_at + INTERVAL '12 days' <= NOW() + INTERVAL '1 day' -- Schedule within next 24 hours
    AND wi.last_contact_at + INTERVAL '12 days' >= NOW() -- Not in the past
    AND NOT EXISTS (
      SELECT 1 FROM reminder_queue rq
      WHERE rq.work_item_id = wi.id
        AND rq.reminder_template_id = rt.id
        AND rq.scheduled_for::date = (wi.last_contact_at + INTERVAL '12 days')::date
    )
  RETURNING reminder_queue.work_item_id, rt.key, reminder_queue.scheduled_for;

  -- Payment overdue reminders
  RETURN QUERY
  INSERT INTO reminder_queue (work_item_id, reminder_template_id, scheduled_for)
  SELECT
    wi.id,
    rt.id,
    wi.created_at + (rt.trigger_days || ' days')::INTERVAL
  FROM work_items wi
  CROSS JOIN reminder_templates rt
  WHERE wi.status IN ('deposit_paid', 'awaiting_balance')
    AND wi.closed_at IS NULL
    AND wi.shopify_financial_status != 'paid'
    AND rt.trigger_type = 'payment_overdue'
    AND rt.is_active = TRUE
    AND wi.created_at + (rt.trigger_days || ' days')::INTERVAL <= NOW() + INTERVAL '1 day'
    AND wi.created_at + (rt.trigger_days || ' days')::INTERVAL >= NOW()
    AND NOT EXISTS (
      SELECT 1 FROM reminder_queue rq
      WHERE rq.work_item_id = wi.id
        AND rq.reminder_template_id = rt.id
        AND rq.status IN ('pending', 'sent')
        AND rq.created_at > NOW() - INTERVAL '7 days' -- Don't spam, wait 7 days between reminders
    )
  RETURNING reminder_queue.work_item_id, rt.key, reminder_queue.scheduled_for;

  -- Files not received reminders
  RETURN QUERY
  INSERT INTO reminder_queue (work_item_id, reminder_template_id, scheduled_for)
  SELECT
    wi.id,
    rt.id,
    COALESCE(wi.last_contact_at, wi.created_at) + (rt.trigger_days || ' days')::INTERVAL
  FROM work_items wi
  CROSS JOIN reminder_templates rt
  WHERE wi.status IN ('awaiting_files', 'customer_providing_artwork')
    AND wi.closed_at IS NULL
    AND rt.trigger_type = 'files_not_received'
    AND rt.is_active = TRUE
    AND COALESCE(wi.last_contact_at, wi.created_at) + (rt.trigger_days || ' days')::INTERVAL <= NOW() + INTERVAL '1 day'
    AND COALESCE(wi.last_contact_at, wi.created_at) + (rt.trigger_days || ' days')::INTERVAL >= NOW()
    AND NOT EXISTS (
      SELECT 1 FROM reminder_queue rq
      WHERE rq.work_item_id = wi.id
        AND rq.reminder_template_id = rt.id
        AND rq.status IN ('pending', 'sent')
        AND rq.created_at > NOW() - INTERVAL '7 days'
    )
  RETURNING reminder_queue.work_item_id, rt.key, reminder_queue.scheduled_for;

  -- Design review pending reminders (internal)
  RETURN QUERY
  INSERT INTO reminder_queue (work_item_id, reminder_template_id, scheduled_for)
  SELECT
    wi.id,
    rt.id,
    wi.updated_at + (rt.trigger_days || ' days')::INTERVAL
  FROM work_items wi
  CROSS JOIN reminder_templates rt
  WHERE wi.status = 'design_received'
    AND wi.design_review_status = 'pending'
    AND wi.closed_at IS NULL
    AND rt.trigger_type = 'design_review_pending'
    AND rt.is_active = TRUE
    AND wi.updated_at + (rt.trigger_days || ' days')::INTERVAL <= NOW() + INTERVAL '1 day'
    AND wi.updated_at + (rt.trigger_days || ' days')::INTERVAL >= NOW()
    AND NOT EXISTS (
      SELECT 1 FROM reminder_queue rq
      WHERE rq.work_item_id = wi.id
        AND rq.reminder_template_id = rt.id
        AND rq.status IN ('pending', 'sent')
        AND rq.created_at > NOW() - INTERVAL '3 days'
    )
  RETURNING reminder_queue.work_item_id, rt.key, reminder_queue.scheduled_for;
END;
$$;

COMMENT ON FUNCTION generate_reminders IS
'Generates reminder queue items for work items that need follow-up. Run daily via cron.';

-- 5. CREATE FUNCTION TO GET PENDING REMINDERS
-- ============================================================================
CREATE OR REPLACE FUNCTION get_pending_reminders(p_limit INTEGER DEFAULT 10)
RETURNS TABLE (
  reminder_id UUID,
  work_item_id UUID,
  template_key TEXT,
  customer_email TEXT,
  customer_name TEXT,
  work_item_title TEXT,
  subject TEXT,
  body_html TEXT,
  send_to_customer BOOLEAN,
  send_to_operator BOOLEAN,
  operator_email TEXT
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    rq.id,
    rq.work_item_id,
    rt.key,
    c.email,
    COALESCE(c.display_name, c.email),
    wi.title,
    rt.subject_template,
    rt.body_html_template,
    rt.send_to_customer,
    rt.send_to_operator,
    rt.operator_email
  FROM reminder_queue rq
  INNER JOIN reminder_templates rt ON rq.reminder_template_id = rt.id
  INNER JOIN work_items wi ON rq.work_item_id = wi.id
  LEFT JOIN customers c ON wi.customer_id = c.id
  WHERE rq.status = 'pending'
    AND rq.scheduled_for <= NOW()
  ORDER BY rq.scheduled_for
  LIMIT p_limit;
END;
$$;

COMMENT ON FUNCTION get_pending_reminders IS
'Gets pending reminders ready to be sent. Returns merged template data.';

-- 6. CREATE REMINDER STATS VIEW
-- ============================================================================
CREATE OR REPLACE VIEW reminder_stats AS
SELECT
  rt.key as template_key,
  rt.name as template_name,
  rt.trigger_type,
  COUNT(rq.id) FILTER (WHERE rq.status = 'pending') as pending_count,
  COUNT(rq.id) FILTER (WHERE rq.status = 'sent') as sent_count,
  COUNT(rq.id) FILTER (WHERE rq.status = 'failed') as failed_count,
  MAX(rq.sent_at) as last_sent_at,
  rt.is_active
FROM reminder_templates rt
LEFT JOIN reminder_queue rq ON rt.id = rq.reminder_template_id
GROUP BY rt.id, rt.key, rt.name, rt.trigger_type, rt.is_active
ORDER BY rt.trigger_type, rt.key;

COMMENT ON VIEW reminder_stats IS
'Statistics for reminder templates showing send counts and status.';

-- 7. ADD UPDATED_AT TRIGGERS
-- ============================================================================
CREATE TRIGGER update_reminder_templates_updated_at
BEFORE UPDATE ON reminder_templates
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_reminder_queue_updated_at
BEFORE UPDATE ON reminder_queue
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

-- 8. LOG MIGRATION RESULTS
-- ============================================================================
DO $$
DECLARE
  template_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO template_count FROM reminder_templates;

  RAISE NOTICE 'Auto-Reminder Engine Migration Complete';
  RAISE NOTICE '======================================';
  RAISE NOTICE 'Created tables:';
  RAISE NOTICE '  - reminder_templates';
  RAISE NOTICE '  - reminder_queue';
  RAISE NOTICE '';
  RAISE NOTICE 'Seeded % reminder templates:', template_count;
  RAISE NOTICE '  - Approval expiring (2 days before)';
  RAISE NOTICE '  - Payment overdue (7 days)';
  RAISE NOTICE '  - Files not received (7 days)';
  RAISE NOTICE '  - Design review pending (3 days - internal)';
  RAISE NOTICE '';
  RAISE NOTICE 'Created functions:';
  RAISE NOTICE '  - generate_reminders() - Run daily via cron';
  RAISE NOTICE '  - get_pending_reminders() - Get reminders to send';
  RAISE NOTICE '';
  RAISE NOTICE 'Created view:';
  RAISE NOTICE '  - reminder_stats';
  RAISE NOTICE '';
  RAISE NOTICE 'Next steps:';
  RAISE NOTICE '  1. Create cron job: /api/cron/generate-reminders';
  RAISE NOTICE '  2. Create cron job: /api/cron/send-reminders';
  RAISE NOTICE '  3. Set up email sending (Microsoft Graph API)';
END $$;
-- ============================================================================
-- Migration: Create Quick Reply Templates
-- Purpose: Pre-built responses for common customer questions (e.g., "Customization options")
-- Created: 2026-02-19
-- ============================================================================

-- 1. CREATE QUICK_REPLY_TEMPLATES TABLE
-- ============================================================================
CREATE TABLE quick_reply_templates (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

  -- Template identification
  key TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  category TEXT DEFAULT 'general' CHECK (category IN (
    'general',
    'customization_options',
    'shipping_timeline',
    'design_changes',
    'payment_terms',
    'file_requirements',
    'support'
  )),

  -- Template content
  subject_template TEXT,
  body_html_template TEXT NOT NULL,
  body_plain_template TEXT,

  -- Merge fields
  merge_fields TEXT[], -- {{customer_name}}, {{work_item_title}}, etc.

  -- Attachments
  has_attachments BOOLEAN DEFAULT FALSE,
  attachment_urls TEXT[],

  -- Configuration
  is_active BOOLEAN DEFAULT TRUE,
  requires_customization BOOLEAN DEFAULT FALSE, -- Must edit before sending

  -- Usage stats
  use_count INTEGER DEFAULT 0,
  last_used_at TIMESTAMPTZ,

  -- Shortcuts
  keyboard_shortcut TEXT, -- e.g., "Ctrl+1" or just "1" for quick access

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_quick_reply_category ON quick_reply_templates(category);
CREATE INDEX idx_quick_reply_active ON quick_reply_templates(is_active) WHERE is_active = TRUE;
CREATE INDEX idx_quick_reply_shortcut ON quick_reply_templates(keyboard_shortcut) WHERE keyboard_shortcut IS NOT NULL;

-- 2. SEED COMMON QUICK REPLY TEMPLATES
-- ============================================================================

-- Customization options (316 instances in EMAIL_TYPES_DETAILED_REPORT.md)
INSERT INTO quick_reply_templates (
  key,
  name,
  description,
  category,
  subject_template,
  body_html_template,
  merge_fields,
  keyboard_shortcut
) VALUES (
  'customization_options',
  'Customization Options - Standard',
  'Explain customization options for fan products',
  'customization_options',
  'Re: {{original_subject}}',
  '<p>Hi {{customer_name}},</p>

<p>Great question! Here are the customization options available for your order:</p>

<h3>Text & Design</h3>
<ul>
  <li><strong>Custom Text:</strong> Add any text you''d like (names, messages, logos)</li>
  <li><strong>Colors:</strong> Choose from our full color palette</li>
  <li><strong>Font Options:</strong> Multiple fonts available (we can send samples)</li>
  <li><strong>Positioning:</strong> We can adjust placement to fit your design</li>
</ul>

<h3>Special Features</h3>
<ul>
  <li><strong>Double-Sided:</strong> Different designs on each side</li>
  <li><strong>Metallic/Foil:</strong> Add shimmer or metallic accents</li>
  <li><strong>Photo Printing:</strong> High-quality photo reproduction</li>
</ul>

<p>Would you like to schedule a quick call to discuss your specific needs? Or feel free to share your design ideas, and I''ll create a mockup for you!</p>

<p>Best regards,<br>
The Gay Fan Club Team</p>',
  ARRAY['customer_name', 'original_subject'],
  '1'
);

-- Shipping timeline
INSERT INTO quick_reply_templates (
  key,
  name,
  description,
  category,
  subject_template,
  body_html_template,
  merge_fields,
  keyboard_shortcut
) VALUES (
  'shipping_timeline',
  'Shipping Timeline - Standard',
  'Explain standard production and shipping timeline',
  'shipping_timeline',
  'Re: {{original_subject}}',
  '<p>Hi {{customer_name}},</p>

<p>Here''s our typical timeline for your order:</p>

<ul>
  <li><strong>Design Approval:</strong> 1-2 business days after we receive your artwork/details</li>
  <li><strong>Production:</strong> 7-10 business days after approval</li>
  <li><strong>Shipping:</strong> 3-5 business days (standard) or 2-3 days (expedited)</li>
</ul>

<p><strong>Total Time:</strong> Approximately 2-3 weeks from design approval to delivery.</p>

<p>If you have a specific event date, let me know and we''ll do our best to accommodate!</p>

<p>Best regards,<br>
The Gay Fan Club Team</p>',
  ARRAY['customer_name', 'original_subject'],
  '2'
);

-- File requirements
INSERT INTO quick_reply_templates (
  key,
  name,
  description,
  category,
  subject_template,
  body_html_template,
  merge_fields,
  keyboard_shortcut
) VALUES (
  'file_requirements',
  'File Requirements & Formats',
  'Explain what file formats and requirements we need',
  'file_requirements',
  'Re: {{original_subject}}',
  '<p>Hi {{customer_name}},</p>

<p>To get started with your custom design, here''s what we need:</p>

<h3>Preferred File Formats</h3>
<ul>
  <li><strong>Vector files:</strong> AI, EPS, PDF, SVG (best quality)</li>
  <li><strong>High-res images:</strong> PNG, JPG (at least 300 DPI)</li>
  <li><strong>Design files:</strong> PSD, Illustrator files</li>
</ul>

<h3>Requirements</h3>
<ul>
  <li>Minimum resolution: 300 DPI</li>
  <li>RGB or CMYK color mode</li>
  <li>Transparent background (if applicable)</li>
  <li>Editable text layers (for text changes)</li>
</ul>

<p><strong>Don''t have the right files?</strong> No problem! Send us what you have, and our design team can work with it or recreate it for you.</p>

<p>You can reply to this email with your files attached, or use our secure upload portal: [Upload Link]</p>

<p>Best regards,<br>
The Gay Fan Club Team</p>',
  ARRAY['customer_name', 'original_subject'],
  '3'
);

-- Design changes
INSERT INTO quick_reply_templates (
  key,
  name,
  description,
  category,
  subject_template,
  body_html_template,
  merge_fields,
  keyboard_shortcut
) VALUES (
  'design_changes_revision',
  'Design Changes - Revision Request',
  'Acknowledge design change request',
  'design_changes',
  'Re: {{original_subject}}',
  '<p>Hi {{customer_name}},</p>

<p>Thanks for your feedback on the design! I''ll have our design team make the following changes:</p>

<p><em>[List the requested changes here]</em></p>

<p>We''ll send you an updated proof within 1-2 business days.</p>

<p><strong>Reminder:</strong> You get unlimited revisions until the design is perfect! Don''t hesitate to request any changes.</p>

<p>Best regards,<br>
The Gay Fan Club Team</p>',
  ARRAY['customer_name', 'original_subject'],
  '4'
);

-- Missing items support
INSERT INTO quick_reply_templates (
  key,
  name,
  description,
  category,
  subject_template,
  body_html_template,
  merge_fields,
  keyboard_shortcut
) VALUES (
  'support_missing_items',
  'Support - Missing Items',
  'Handle missing items from shipment',
  'support',
  'Re: Missing Items - {{work_item_title}}',
  '<p>Hi {{customer_name}},</p>

<p>I''m so sorry to hear that some items are missing from your shipment! We take this very seriously.</p>

<p>To help resolve this as quickly as possible, could you please provide:</p>

<ol>
  <li>Which specific items are missing (names, quantities)</li>
  <li>Photo of what you received</li>
  <li>Order number (if not already included)</li>
</ol>

<p>Once we have this information, we''ll:</p>
<ul>
  <li>Verify the shipment details</li>
  <li>Rush replacement items to you at no charge</li>
  <li>Provide expedited shipping</li>
</ul>

<p>I''ll personally make sure this is resolved immediately. Please reply with the details above.</p>

<p>Sincerely,<br>
The Gay Fan Club Team</p>',
  ARRAY['customer_name', 'work_item_title'],
  NULL
);

-- Damaged items support
INSERT INTO quick_reply_templates (
  key,
  name,
  description,
  category,
  subject_template,
  body_html_template,
  merge_fields,
  keyboard_shortcut
) VALUES (
  'support_damaged_items',
  'Support - Damaged Items',
  'Handle damaged items report',
  'support',
  'Re: Damaged Items - {{work_item_title}}',
  '<p>Hi {{customer_name}},</p>

<p>I''m very sorry to hear that your items arrived damaged. This is not the quality we stand for!</p>

<p>To process your replacement as quickly as possible, please send us:</p>

<ol>
  <li>Photos of the damaged items (close-ups showing the damage)</li>
  <li>Photo of the shipping box/packaging (if damaged)</li>
  <li>Number of damaged items</li>
</ol>

<p>We''ll immediately:</p>
<ul>
  <li>Rush replacement items into production</li>
  <li>Ship with expedited delivery at no charge</li>
  <li>File a claim with the shipping carrier</li>
</ul>

<p>You don''t need to return the damaged items. Just reply with the photos, and we''ll take care of everything.</p>

<p>Sincerely,<br>
The Gay Fan Club Team</p>',
  ARRAY['customer_name', 'work_item_title'],
  NULL
);

-- Payment terms
INSERT INTO quick_reply_templates (
  key,
  name,
  description,
  category,
  subject_template,
  body_html_template,
  merge_fields,
  keyboard_shortcut
) VALUES (
  'payment_terms',
  'Payment Terms & Options',
  'Explain payment terms and available options',
  'payment_terms',
  'Re: {{original_subject}}',
  '<p>Hi {{customer_name}},</p>

<p>Here are our payment options for your order:</p>

<h3>Payment Structure</h3>
<ul>
  <li><strong>50% Deposit:</strong> Due upfront to start production</li>
  <li><strong>50% Balance:</strong> Due before shipping</li>
</ul>

<h3>Payment Methods</h3>
<ul>
  <li>Credit/Debit Card (Visa, Mastercard, Amex)</li>
  <li>PayPal</li>
  <li>Bank Transfer/ACH</li>
  <li>Check (add 5-7 business days for processing)</li>
</ul>

<p><strong>Net Terms Available:</strong> For established customers or large orders, we offer Net 30 terms. Just let me know if you''d like to set this up.</p>

<p>Ready to get started? I can send you a secure payment link!</p>

<p>Best regards,<br>
The Gay Fan Club Team</p>',
  ARRAY['customer_name', 'original_subject'],
  '5'
);

-- Bulk order discount
INSERT INTO quick_reply_templates (
  key,
  name,
  description,
  category,
  subject_template,
  body_html_template,
  merge_fields,
  keyboard_shortcut
) VALUES (
  'bulk_order_discount',
  'Bulk Order Discounts',
  'Explain volume pricing and bulk discounts',
  'general',
  'Re: {{original_subject}}',
  '<p>Hi {{customer_name}},</p>

<p>Great question about bulk pricing! We definitely offer discounts for larger orders:</p>

<h3>Volume Discounts</h3>
<ul>
  <li><strong>100-249 units:</strong> 10% off</li>
  <li><strong>250-499 units:</strong> 15% off</li>
  <li><strong>500+ units:</strong> 20% off (+ free shipping)</li>
</ul>

<p><strong>Additional Savings:</strong></p>
<ul>
  <li>Free design setup for orders over 250 units</li>
  <li>Free sample pack with orders over 500 units</li>
  <li>Priority production (faster turnaround)</li>
</ul>

<p>How many units are you thinking? I can send you a custom quote with exact pricing!</p>

<p>Best regards,<br>
The Gay Fan Club Team</p>',
  ARRAY['customer_name', 'original_subject'],
  '6'
);

-- 3. CREATE FUNCTION TO INCREMENT USE COUNT
-- ============================================================================
CREATE OR REPLACE FUNCTION track_template_usage(p_template_id UUID)
RETURNS VOID
LANGUAGE plpgsql
AS $$
BEGIN
  UPDATE quick_reply_templates
  SET
    use_count = use_count + 1,
    last_used_at = NOW(),
    updated_at = NOW()
  WHERE id = p_template_id;
END;
$$;

COMMENT ON FUNCTION track_template_usage IS
'Increments use_count when a template is used.';

-- 4. CREATE TEMPLATE USAGE STATS VIEW
-- ============================================================================
CREATE OR REPLACE VIEW template_usage_stats AS
SELECT
  t.key,
  t.name,
  t.category,
  t.use_count,
  t.last_used_at,
  t.is_active,
  t.keyboard_shortcut
FROM quick_reply_templates t
WHERE t.is_active = TRUE
ORDER BY t.use_count DESC;

COMMENT ON VIEW template_usage_stats IS
'Usage statistics for quick reply templates, ordered by most used.';

-- 5. ADD UPDATED_AT TRIGGER
-- ============================================================================
CREATE TRIGGER update_quick_reply_templates_updated_at
BEFORE UPDATE ON quick_reply_templates
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

-- 6. LOG MIGRATION RESULTS
-- ============================================================================
DO $$
DECLARE
  template_count INTEGER;
  category_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO template_count FROM quick_reply_templates;
  SELECT COUNT(DISTINCT category) INTO category_count FROM quick_reply_templates;

  RAISE NOTICE 'Quick Reply Templates Migration Complete';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'Created table: quick_reply_templates';
  RAISE NOTICE '';
  RAISE NOTICE 'Seeded % templates across % categories:', template_count, category_count;
  RAISE NOTICE '  - Customization options (solves 316 manual responses)';
  RAISE NOTICE '  - Shipping timeline';
  RAISE NOTICE '  - File requirements';
  RAISE NOTICE '  - Design changes';
  RAISE NOTICE '  - Support (missing/damaged items)';
  RAISE NOTICE '  - Payment terms';
  RAISE NOTICE '  - Bulk order discounts';
  RAISE NOTICE '';
  RAISE NOTICE 'Keyboard shortcuts:';
  RAISE NOTICE '  1 - Customization options';
  RAISE NOTICE '  2 - Shipping timeline';
  RAISE NOTICE '  3 - File requirements';
  RAISE NOTICE '  4 - Design changes';
  RAISE NOTICE '  5 - Payment terms';
  RAISE NOTICE '  6 - Bulk discounts';
  RAISE NOTICE '';
  RAISE NOTICE 'Created function: track_template_usage()';
  RAISE NOTICE 'Created view: template_usage_stats';
  RAISE NOTICE '';
  RAISE NOTICE 'Next steps:';
  RAISE NOTICE '  - Add UI in /email-intake for quick replies';
  RAISE NOTICE '  - Implement keyboard shortcuts';
  RAISE NOTICE '  - Add template editor for customization';
END $$;
