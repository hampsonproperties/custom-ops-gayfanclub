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
