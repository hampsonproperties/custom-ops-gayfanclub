-- ============================================================================
-- Force Refresh All Stuck Items Views
-- Purpose: Rebuild all stuck items views to ensure data consistency
-- Run this AFTER running FIX_STUCK_ITEMS_BATCHED_ORDERS.sql
-- ============================================================================

-- This script doesn't change the view definitions, it just forces PostgreSQL
-- to refresh them by recreating them. This can help if there's a caching issue.

-- Drop the summary view first (depends on other views)
DROP VIEW IF EXISTS stuck_items_summary CASCADE;

-- Drop the unified dashboard
DROP VIEW IF EXISTS stuck_items_dashboard CASCADE;

-- Now recreate them using the CURRENT definitions in the database
-- (This assumes you've already run FIX_STUCK_ITEMS_BATCHED_ORDERS.sql)

-- Recreate unified dashboard
CREATE OR REPLACE VIEW stuck_items_dashboard AS
SELECT
  ea.id as work_item_id,
  NULL::uuid as dlq_id,
  ea.type as item_type,
  ea.title,
  ea.customer_name,
  ea.customer_email,
  ea.status,
  ea.stuck_reason,
  ea.priority_score,
  ea.days_waiting::integer as days_stuck,
  ea.created_at,
  ea.last_contact_at,
  ea.next_follow_up_at
FROM stuck_expired_approvals ea

UNION ALL

SELECT
  oi.id,
  NULL::uuid,
  oi.type,
  oi.title,
  oi.customer_name,
  oi.customer_email,
  oi.status,
  oi.stuck_reason,
  oi.priority_score,
  oi.days_since_deposit::integer,
  oi.created_at,
  oi.last_contact_at,
  oi.next_follow_up_at
FROM stuck_overdue_invoices oi

UNION ALL

SELECT
  af.id,
  NULL::uuid,
  af.type,
  af.title,
  af.customer_name,
  af.customer_email,
  af.status,
  af.stuck_reason,
  af.priority_score,
  af.days_waiting::integer,
  af.created_at,
  af.last_contact_at,
  af.next_follow_up_at
FROM stuck_awaiting_files af

UNION ALL

SELECT
  dr.id,
  NULL::uuid,
  dr.type,
  dr.title,
  dr.customer_name,
  dr.customer_email,
  dr.status,
  dr.stuck_reason,
  dr.priority_score,
  dr.days_pending::integer,
  dr.created_at,
  NULL::timestamptz as last_contact_at,
  dr.next_follow_up_at
FROM stuck_design_review dr

UNION ALL

SELECT
  nf.id,
  NULL::uuid,
  nf.type,
  nf.title,
  nf.customer_name,
  nf.customer_email,
  nf.status,
  nf.stuck_reason,
  nf.priority_score,
  nf.days_since_update::integer,
  nf.created_at,
  nf.last_contact_at,
  nf.next_follow_up_at
FROM stuck_no_follow_up nf

UNION ALL

SELECT
  si.id,
  NULL::uuid,
  si.type,
  si.title,
  si.customer_name,
  si.customer_email,
  si.status,
  si.stuck_reason,
  si.priority_score,
  si.days_stale::integer,
  si.created_at,
  si.last_contact_at,
  si.next_follow_up_at
FROM stuck_stale_items si

UNION ALL

SELECT
  dlq.work_item_id,
  dlq.id,
  dlq.operation_type::text,
  dlq.operation_key,
  NULL::text as customer_name,
  NULL::text as customer_email,
  'dlq_failure',
  dlq.stuck_reason,
  dlq.priority_score,
  dlq.days_failed::integer,
  dlq.created_at,
  dlq.last_retry_at,
  NULL::timestamptz as next_follow_up_at
FROM stuck_dlq_failures dlq
WHERE dlq.work_item_id IS NOT NULL

ORDER BY priority_score DESC, days_stuck DESC;

COMMENT ON VIEW stuck_items_dashboard IS
'Unified dashboard of all stuck items across all categories. Orders in production/batched are excluded from stale detection.';

-- Recreate summary view
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

-- Verify the refresh
DO $$
DECLARE
  summary_stats RECORD;
  dashboard_count INTEGER;
BEGIN
  SELECT * INTO summary_stats FROM stuck_items_summary;
  SELECT COUNT(*) INTO dashboard_count FROM stuck_items_dashboard;

  RAISE NOTICE 'Stuck Items Views Refreshed';
  RAISE NOTICE '==========================';
  RAISE NOTICE 'Summary total: %', summary_stats.total_stuck_items;
  RAISE NOTICE 'Dashboard rows: %', dashboard_count;
  RAISE NOTICE '';

  IF summary_stats.total_stuck_items = dashboard_count THEN
    RAISE NOTICE '✅ Views are synchronized!';
  ELSE
    RAISE NOTICE '⚠️  View mismatch detected';
    RAISE NOTICE 'Summary: %, Dashboard: %', summary_stats.total_stuck_items, dashboard_count;
  END IF;

  RAISE NOTICE '';
  RAISE NOTICE 'Breakdown:';
  RAISE NOTICE '  Expired approvals: %', summary_stats.expired_approvals_count;
  RAISE NOTICE '  Overdue invoices: %', summary_stats.overdue_invoices_count;
  RAISE NOTICE '  Awaiting files: %', summary_stats.awaiting_files_count;
  RAISE NOTICE '  Design review: %', summary_stats.design_review_count;
  RAISE NOTICE '  No follow-up: %', summary_stats.no_follow_up_count;
  RAISE NOTICE '  Stale items: %', summary_stats.stale_items_count;
  RAISE NOTICE '  DLQ failures: %', summary_stats.dlq_failures_count;
END $$;
