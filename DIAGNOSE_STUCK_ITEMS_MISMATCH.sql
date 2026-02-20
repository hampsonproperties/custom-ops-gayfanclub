-- ============================================================================
-- Diagnostic: Why Dashboard Shows 0 But Page Shows 20+ Stuck Items
-- Run this in Supabase SQL Editor to investigate the data mismatch
-- ============================================================================

-- Check 1: What does the summary view show?
-- ============================================================================
SELECT 'SUMMARY VIEW' as check_name, * FROM stuck_items_summary;

-- Check 2: How many items in the dashboard view?
-- ============================================================================
SELECT 'DASHBOARD VIEW - Total Count' as check_name, COUNT(*) as total_count
FROM stuck_items_dashboard;

-- Check 3: Breakdown by stuck reason in dashboard view
-- ============================================================================
SELECT
  'DASHBOARD VIEW - By Reason' as check_name,
  stuck_reason,
  COUNT(*) as count
FROM stuck_items_dashboard
GROUP BY stuck_reason
ORDER BY count DESC;

-- Check 4: Individual view counts (what summary SHOULD show)
-- ============================================================================
SELECT 'INDIVIDUAL VIEW COUNTS' as check_name,
  (SELECT COUNT(*) FROM stuck_expired_approvals) as expired_approvals,
  (SELECT COUNT(*) FROM stuck_overdue_invoices) as overdue_invoices,
  (SELECT COUNT(*) FROM stuck_awaiting_files) as awaiting_files,
  (SELECT COUNT(*) FROM stuck_design_review) as design_review,
  (SELECT COUNT(*) FROM stuck_no_follow_up) as no_follow_up,
  (SELECT COUNT(*) FROM stuck_stale_items) as stale_items,
  (SELECT COUNT(*) FROM stuck_dlq_failures) as dlq_failures;

-- Check 5: How many batched/production orders exist?
-- ============================================================================
SELECT
  'BATCHED ORDERS' as check_name,
  status,
  COUNT(*) as count
FROM work_items
WHERE status IN ('batched', 'ready_for_batch', 'in_production', 'in_transit')
  AND closed_at IS NULL
GROUP BY status
ORDER BY count DESC;

-- Check 6: Are batched orders appearing in stuck_stale_items? (SHOULD BE 0 after fix)
-- ============================================================================
SELECT
  'BATCHED ORDERS IN STALE VIEW' as check_name,
  COUNT(*) as count,
  CASE
    WHEN COUNT(*) > 0 THEN '❌ FIX NOT APPLIED - Run FIX_STUCK_ITEMS_BATCHED_ORDERS.sql'
    ELSE '✅ FIX APPLIED - Batched orders excluded'
  END as status
FROM stuck_stale_items
WHERE status IN ('batched', 'ready_for_batch', 'in_production', 'in_transit');

-- Check 7: Sample of items in dashboard view
-- ============================================================================
SELECT
  'SAMPLE DASHBOARD ITEMS' as check_name,
  work_item_id,
  item_type,
  title,
  status,
  stuck_reason,
  days_stuck
FROM stuck_items_dashboard
ORDER BY priority_score DESC, days_stuck DESC
LIMIT 10;

-- Check 8: Check if stuck_stale_items view has next_follow_up_at column
-- ============================================================================
SELECT
  'VIEW COLUMN CHECK' as check_name,
  column_name,
  data_type
FROM information_schema.columns
WHERE table_name = 'stuck_stale_items'
  AND column_name = 'next_follow_up_at';

-- SUMMARY
-- ============================================================================
DO $$
DECLARE
  summary_count INTEGER;
  dashboard_count INTEGER;
  batched_in_stuck INTEGER;
BEGIN
  SELECT total_stuck_items INTO summary_count FROM stuck_items_summary;
  SELECT COUNT(*) INTO dashboard_count FROM stuck_items_dashboard;
  SELECT COUNT(*) INTO batched_in_stuck
    FROM stuck_stale_items
    WHERE status IN ('batched', 'ready_for_batch', 'in_production', 'in_transit');

  RAISE NOTICE '';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'STUCK ITEMS DIAGNOSIS';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'Summary view total: %', summary_count;
  RAISE NOTICE 'Dashboard view total: %', dashboard_count;
  RAISE NOTICE 'Batched orders in stuck view: %', batched_in_stuck;
  RAISE NOTICE '';

  IF summary_count = 0 AND dashboard_count > 0 THEN
    RAISE NOTICE '❌ MISMATCH DETECTED!';
    RAISE NOTICE 'Dashboard shows % but summary shows 0', dashboard_count;
    RAISE NOTICE 'This suggests a view caching or refresh issue.';
  ELSIF batched_in_stuck > 0 THEN
    RAISE NOTICE '❌ BATCHED ORDERS SHOWING AS STUCK';
    RAISE NOTICE 'Run FIX_STUCK_ITEMS_BATCHED_ORDERS.sql to exclude them.';
  ELSE
    RAISE NOTICE '✅ Views appear synchronized';
  END IF;
  RAISE NOTICE '========================================';
END $$;
