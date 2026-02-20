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
