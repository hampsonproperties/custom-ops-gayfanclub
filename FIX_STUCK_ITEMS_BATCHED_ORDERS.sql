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
  wi.next_follow_up_at,  -- Add this so the dashboard can reference it
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

-- Also fix stuck_design_review to include next_follow_up_at
DROP VIEW IF EXISTS stuck_design_review CASCADE;

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
  wi.next_follow_up_at,  -- Add this column
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

-- Recreate the unified dashboard (depends on stuck_stale_items)
DROP VIEW IF EXISTS stuck_items_dashboard CASCADE;

CREATE OR REPLACE VIEW stuck_items_dashboard AS
-- Expired approvals
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

-- Overdue invoices
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

-- Awaiting files
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

-- Design review pending
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

-- No follow-up scheduled
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

-- Stale items (NOW EXCLUDES BATCHED ORDERS)
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

-- DLQ failures (with work_item_id)
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
