-- ============================================================================
-- Fix: Exclude Production Statuses from Stuck Items Detection
-- Purpose: Batched/production orders shouldn't show as "stuck" or "stale"
-- Run this in Supabase SQL Editor
-- ============================================================================

-- Drop the old view
DROP VIEW IF EXISTS stuck_stale_items CASCADE;

-- Recreate with production statuses excluded
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
  -- Exclude statuses that are actively being worked on or completed
  AND wi.status NOT IN (
    'shipped',              -- Already delivered
    'cancelled',            -- Cancelled orders
    'batched',              -- In production batch
    'ready_for_batch',      -- Waiting to be batched (normal)
    'in_production',        -- Being manufactured
    'in_transit'            -- On the way to customer
  )
  AND GREATEST(
    COALESCE(wi.last_contact_at, wi.created_at),
    wi.updated_at
  ) < NOW() - INTERVAL '14 days'
ORDER BY GREATEST(
  COALESCE(wi.last_contact_at, wi.created_at),
  wi.updated_at
);

COMMENT ON VIEW stuck_stale_items IS
'Work items with no activity (updates or communication) for >14 days. Excludes orders in production or shipped.';

-- Recreate the unified dashboard (depends on stuck_stale_items)
DROP VIEW IF EXISTS stuck_items_dashboard;

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

-- Stale items (NOW EXCLUDES BATCHED ORDERS)
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
'Unified dashboard of all stuck items across all categories. Orders in production/batched are excluded from stale detection.';

-- Verify the fix
DO $$
DECLARE
  stale_count INTEGER;
  batched_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO stale_count FROM stuck_stale_items;

  SELECT COUNT(*) INTO batched_count
  FROM work_items
  WHERE status IN ('batched', 'ready_for_batch', 'in_production', 'in_transit')
    AND closed_at IS NULL;

  RAISE NOTICE 'Stuck Items Fix Applied';
  RAISE NOTICE '=====================';
  RAISE NOTICE 'Stale items found: %', stale_count;
  RAISE NOTICE 'Orders in production (excluded): %', batched_count;
  RAISE NOTICE '';
  RAISE NOTICE 'Batched/production orders will no longer show as stuck!';
END $$;
