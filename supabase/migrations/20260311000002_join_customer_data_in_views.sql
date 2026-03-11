-- ============================================================================
-- Migration: Join customer data in views instead of reading denormalized fields
-- Purpose: Phase 2 — Stop relying on duplicate customer_name/customer_email/company_name
--          on work_items. Instead, join to customers table using COALESCE fallback.
-- Created: 2026-03-11
-- ============================================================================

-- 1. STUCK ITEMS VIEWS — Rewrite all 6 work-item views to join customers
-- ============================================================================

-- 1a. EXPIRED APPROVALS
CREATE OR REPLACE VIEW stuck_expired_approvals AS
SELECT
  wi.id,
  wi.type,
  wi.title,
  COALESCE(c.display_name, wi.customer_name) AS customer_name,
  COALESCE(c.email, wi.customer_email) AS customer_email,
  wi.status,
  wi.created_at,
  wi.last_contact_at,
  wi.next_follow_up_at,
  EXTRACT(DAYS FROM (NOW() - COALESCE(wi.last_contact_at, wi.created_at))) as days_waiting,
  'expired_approval' as stuck_reason,
  3 as priority_score
FROM work_items wi
LEFT JOIN customers c ON c.id = wi.customer_id
WHERE wi.status = 'awaiting_approval'
  AND wi.closed_at IS NULL
  AND COALESCE(wi.last_contact_at, wi.created_at) < NOW() - INTERVAL '14 days'
ORDER BY wi.created_at;

-- 1b. OVERDUE INVOICES
CREATE OR REPLACE VIEW stuck_overdue_invoices AS
SELECT
  wi.id,
  wi.type,
  wi.title,
  COALESCE(c.display_name, wi.customer_name) AS customer_name,
  COALESCE(c.email, wi.customer_email) AS customer_email,
  wi.status,
  wi.shopify_financial_status,
  wi.created_at,
  wi.last_contact_at,
  wi.next_follow_up_at,
  EXTRACT(DAYS FROM (NOW() - wi.created_at)) as days_since_deposit,
  'overdue_invoice' as stuck_reason,
  2 as priority_score
FROM work_items wi
LEFT JOIN customers c ON c.id = wi.customer_id
WHERE wi.status IN ('deposit_paid', 'awaiting_balance')
  AND wi.closed_at IS NULL
  AND wi.shopify_financial_status != 'paid'
  AND wi.created_at < NOW() - INTERVAL '30 days'
ORDER BY wi.created_at;

-- 1c. AWAITING FILES
CREATE OR REPLACE VIEW stuck_awaiting_files AS
SELECT
  wi.id,
  wi.type,
  wi.title,
  COALESCE(c.display_name, wi.customer_name) AS customer_name,
  COALESCE(c.email, wi.customer_email) AS customer_email,
  wi.status,
  wi.created_at,
  wi.last_contact_at,
  wi.next_follow_up_at,
  EXTRACT(DAYS FROM (NOW() - COALESCE(wi.last_contact_at, wi.created_at))) as days_waiting,
  'awaiting_files' as stuck_reason,
  2 as priority_score
FROM work_items wi
LEFT JOIN customers c ON c.id = wi.customer_id
WHERE wi.status IN ('awaiting_files', 'customer_providing_artwork')
  AND wi.closed_at IS NULL
  AND COALESCE(wi.last_contact_at, wi.created_at) < NOW() - INTERVAL '7 days'
ORDER BY wi.last_contact_at NULLS FIRST, wi.created_at;

-- 1d. DESIGN REVIEW PENDING
CREATE OR REPLACE VIEW stuck_design_review AS
SELECT
  wi.id,
  wi.type,
  wi.title,
  COALESCE(c.display_name, wi.customer_name) AS customer_name,
  COALESCE(c.email, wi.customer_email) AS customer_email,
  wi.status,
  wi.design_review_status,
  wi.created_at,
  wi.updated_at,
  EXTRACT(DAYS FROM (NOW() - wi.updated_at)) as days_pending,
  'design_review_pending' as stuck_reason,
  2 as priority_score
FROM work_items wi
LEFT JOIN customers c ON c.id = wi.customer_id
WHERE wi.status = 'design_received'
  AND wi.design_review_status = 'pending'
  AND wi.closed_at IS NULL
  AND wi.updated_at < NOW() - INTERVAL '7 days'
ORDER BY wi.updated_at;

-- 1e. NO FOLLOW-UP SCHEDULED
CREATE OR REPLACE VIEW stuck_no_follow_up AS
SELECT
  wi.id,
  wi.type,
  wi.title,
  COALESCE(c.display_name, wi.customer_name) AS customer_name,
  COALESCE(c.email, wi.customer_email) AS customer_email,
  wi.status,
  wi.created_at,
  wi.last_contact_at,
  wi.next_follow_up_at,
  EXTRACT(DAYS FROM (NOW() - COALESCE(wi.updated_at, wi.created_at))) as days_since_update,
  'no_follow_up_scheduled' as stuck_reason,
  1 as priority_score
FROM work_items wi
LEFT JOIN customers c ON c.id = wi.customer_id
WHERE wi.closed_at IS NULL
  AND wi.next_follow_up_at IS NULL
  AND wi.status NOT IN ('shipped', 'cancelled', 'ready_for_batch', 'batched')
  AND wi.created_at < NOW() - INTERVAL '3 days'
ORDER BY wi.created_at;

-- 1f. STALE ITEMS
CREATE OR REPLACE VIEW stuck_stale_items AS
SELECT
  wi.id,
  wi.type,
  wi.title,
  COALESCE(c.display_name, wi.customer_name) AS customer_name,
  COALESCE(c.email, wi.customer_email) AS customer_email,
  wi.status,
  wi.created_at,
  wi.last_contact_at,
  wi.updated_at,
  EXTRACT(DAYS FROM (NOW() - GREATEST(
    COALESCE(wi.last_contact_at, wi.created_at),
    wi.updated_at
  ))) as days_stale,
  'stale_no_activity' as stuck_reason,
  1 as priority_score
FROM work_items wi
LEFT JOIN customers c ON c.id = wi.customer_id
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

-- Note: stuck_dlq_failures, stuck_items_dashboard, stuck_items_summary
-- do not need changes. stuck_dlq_failures reads from dead_letter_queue.
-- stuck_items_dashboard is a UNION of the above views and automatically
-- picks up the COALESCE'd customer_name/customer_email.
-- stuck_items_summary just counts rows.

-- 2. BATCH EMAIL STATUS FUNCTION — Join customers
-- ============================================================================

CREATE OR REPLACE FUNCTION get_batch_email_status(p_batch_id UUID)
RETURNS TABLE (
  work_item_id UUID,
  customer_name TEXT,
  customer_email TEXT,
  entering_production_status TEXT,
  entering_production_scheduled TIMESTAMPTZ,
  entering_production_sent TIMESTAMPTZ,
  midway_checkin_status TEXT,
  midway_checkin_scheduled TIMESTAMPTZ,
  midway_checkin_sent TIMESTAMPTZ,
  en_route_status TEXT,
  en_route_scheduled TIMESTAMPTZ,
  en_route_sent TIMESTAMPTZ,
  arrived_stateside_status TEXT,
  arrived_stateside_scheduled TIMESTAMPTZ,
  arrived_stateside_sent TIMESTAMPTZ
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    wi.id AS work_item_id,
    COALESCE(c.display_name, wi.customer_name) AS customer_name,
    COALESCE(c.email, wi.customer_email) AS customer_email,

    -- Entering Production
    COALESCE(
      (SELECT status FROM batch_email_queue WHERE batch_id = p_batch_id AND work_item_id = wi.id AND email_type = 'entering_production'),
      (SELECT 'sent'::TEXT FROM batch_email_sends WHERE batch_id = p_batch_id AND work_item_id = wi.id AND email_type = 'entering_production'),
      'not_queued'::TEXT
    ) AS entering_production_status,
    (SELECT scheduled_send_at FROM batch_email_queue WHERE batch_id = p_batch_id AND work_item_id = wi.id AND email_type = 'entering_production' AND status = 'pending') AS entering_production_scheduled,
    (SELECT sent_at FROM batch_email_sends WHERE batch_id = p_batch_id AND work_item_id = wi.id AND email_type = 'entering_production') AS entering_production_sent,

    -- Midway Check-In
    COALESCE(
      (SELECT status FROM batch_email_queue WHERE batch_id = p_batch_id AND work_item_id = wi.id AND email_type = 'midway_checkin'),
      (SELECT 'sent'::TEXT FROM batch_email_sends WHERE batch_id = p_batch_id AND work_item_id = wi.id AND email_type = 'midway_checkin'),
      'not_queued'::TEXT
    ) AS midway_checkin_status,
    (SELECT scheduled_send_at FROM batch_email_queue WHERE batch_id = p_batch_id AND work_item_id = wi.id AND email_type = 'midway_checkin' AND status = 'pending') AS midway_checkin_scheduled,
    (SELECT sent_at FROM batch_email_sends WHERE batch_id = p_batch_id AND work_item_id = wi.id AND email_type = 'midway_checkin') AS midway_checkin_sent,

    -- En Route
    COALESCE(
      (SELECT status FROM batch_email_queue WHERE batch_id = p_batch_id AND work_item_id = wi.id AND email_type = 'en_route'),
      (SELECT 'sent'::TEXT FROM batch_email_sends WHERE batch_id = p_batch_id AND work_item_id = wi.id AND email_type = 'en_route'),
      'not_queued'::TEXT
    ) AS en_route_status,
    (SELECT scheduled_send_at FROM batch_email_queue WHERE batch_id = p_batch_id AND work_item_id = wi.id AND email_type = 'en_route' AND status = 'pending') AS en_route_scheduled,
    (SELECT sent_at FROM batch_email_sends WHERE batch_id = p_batch_id AND work_item_id = wi.id AND email_type = 'en_route') AS en_route_sent,

    -- Arrived Stateside
    COALESCE(
      (SELECT status FROM batch_email_queue WHERE batch_id = p_batch_id AND work_item_id = wi.id AND email_type = 'arrived_stateside'),
      (SELECT 'sent'::TEXT FROM batch_email_sends WHERE batch_id = p_batch_id AND work_item_id = wi.id AND email_type = 'arrived_stateside'),
      'not_queued'::TEXT
    ) AS arrived_stateside_status,
    (SELECT scheduled_send_at FROM batch_email_queue WHERE batch_id = p_batch_id AND work_item_id = wi.id AND email_type = 'arrived_stateside' AND status = 'pending') AS arrived_stateside_scheduled,
    (SELECT sent_at FROM batch_email_sends WHERE batch_id = p_batch_id AND work_item_id = wi.id AND email_type = 'arrived_stateside') AS arrived_stateside_sent

  FROM work_items wi
  LEFT JOIN customers c ON c.id = wi.customer_id
  INNER JOIN batch_items bi ON bi.work_item_id = wi.id
  WHERE bi.batch_id = p_batch_id
  ORDER BY COALESCE(c.display_name, wi.customer_name);
END;
$$ LANGUAGE plpgsql;

-- 3. SALES PIPELINE VIEW — Join customers
-- ============================================================================

DROP VIEW IF EXISTS sales_pipeline;
CREATE VIEW sales_pipeline AS
SELECT
  wi.*,
  COALESCE(c.display_name, wi.customer_name) AS resolved_customer_name,
  COALESCE(c.email, wi.customer_email) AS resolved_customer_email,
  COALESCE(c.organization_name, wi.company_name) AS resolved_company_name,
  -- Computed flags
  CASE
    WHEN wi.next_follow_up_at IS NOT NULL AND wi.next_follow_up_at < NOW() THEN true
    ELSE false
  END as is_overdue,
  CASE
    WHEN wi.next_follow_up_at IS NOT NULL
      AND wi.next_follow_up_at >= NOW()
      AND wi.next_follow_up_at < NOW() + INTERVAL '1 day' THEN true
    ELSE false
  END as is_due_today,
  -- Tags
  ARRAY_AGG(DISTINCT t.name) FILTER (WHERE t.name IS NOT NULL) as tag_names,
  ARRAY_AGG(DISTINCT t.color) FILTER (WHERE t.color IS NOT NULL) as tag_colors,
  -- Email count
  (SELECT COUNT(*) FROM communications WHERE work_item_id = wi.id) as email_count,
  -- Latest email preview
  (SELECT body_preview FROM communications WHERE work_item_id = wi.id ORDER BY received_at DESC LIMIT 1) as latest_email_preview
FROM work_items wi
LEFT JOIN customers c ON c.id = wi.customer_id
LEFT JOIN work_item_tags wit ON wit.work_item_id = wi.id
LEFT JOIN tags t ON t.id = wit.tag_id
WHERE wi.closed_at IS NULL
  AND wi.status IN ('new_inquiry', 'quote_sent', 'design_fee_sent', 'invoice_sent', 'awaiting_payment')
GROUP BY wi.id, c.display_name, c.email, c.organization_name;

-- 4. PRODUCTION PIPELINE VIEW — Join customers
-- ============================================================================

DROP VIEW IF EXISTS production_pipeline;
CREATE VIEW production_pipeline AS
SELECT
  wi.*,
  COALESCE(c.display_name, wi.customer_name) AS resolved_customer_name,
  COALESCE(c.email, wi.customer_email) AS resolved_customer_email,
  -- Tags
  ARRAY_AGG(DISTINCT t.name) FILTER (WHERE t.name IS NOT NULL) as tag_names,
  ARRAY_AGG(DISTINCT t.color) FILTER (WHERE t.color IS NOT NULL) as tag_colors,
  -- Days until event
  CASE
    WHEN wi.event_date IS NOT NULL THEN (wi.event_date::date - CURRENT_DATE::date)
    ELSE NULL
  END as days_until_event,
  -- File count
  (SELECT COUNT(*) FROM files WHERE work_item_id = wi.id) as file_count
FROM work_items wi
LEFT JOIN customers c ON c.id = wi.customer_id
LEFT JOIN work_item_tags wit ON wit.work_item_id = wi.id
LEFT JOIN tags t ON t.id = wit.tag_id
WHERE wi.closed_at IS NULL
  AND wi.status IN ('needs_design_review', 'design_fee_paid', 'awaiting_customer_files',
                    'paid_ready_for_batch', 'deposit_paid_ready_for_batch',
                    'on_payment_terms_ready_for_batch', 'ready_for_batch', 'batched',
                    'in_progress', 'in_transit', 'shipped')
GROUP BY wi.id, c.display_name, c.email;

-- 5. DROP THE SYNC TRIGGER (no longer needed — we read from customer directly)
-- ============================================================================

DROP TRIGGER IF EXISTS trg_sync_customer_email ON customers;
DROP FUNCTION IF EXISTS sync_customer_email_to_work_items();
