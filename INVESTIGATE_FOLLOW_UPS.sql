-- ============================================================================
-- Investigate Follow-Ups Queue
-- Purpose: Find junk work items (PayPal, Shopify, etc.) that shouldn't be there
-- ============================================================================

-- Show all work items that need initial contact
SELECT
  'NEEDS INITIAL CONTACT' as queue,
  id,
  customer_name,
  customer_email,
  title,
  status,
  source,
  shopify_order_number,
  created_at
FROM work_items
WHERE requires_initial_contact = true
  AND closed_at IS NULL
ORDER BY created_at DESC;

-- Find work items from notification-type emails (PayPal, Shopify, etc.)
SELECT
  'JUNK WORK ITEMS' as type,
  id,
  customer_name,
  customer_email,
  title,
  status,
  source,
  created_at
FROM work_items
WHERE closed_at IS NULL
  AND (
    customer_email ILIKE '%@paypal.com%'
    OR customer_email ILIKE '%noreply%'
    OR customer_email ILIKE '%no-reply%'
    OR customer_email ILIKE '%@shopify.com%'
    OR customer_email ILIKE '%@stripe.com%'
    OR customer_email ILIKE '%@notifications.%'
    OR customer_name ILIKE '%paypal%'
    OR customer_name ILIKE '%shopify%'
    OR title ILIKE '%order confirmation%'
    OR title ILIKE '%receipt%'
    OR title ILIKE '%invoice%'
  )
ORDER BY created_at DESC;

-- Show overdue follow-ups
SELECT
  'OVERDUE FOLLOW-UPS' as queue,
  id,
  customer_name,
  customer_email,
  title,
  status,
  next_follow_up_at,
  DATE_PART('day', NOW() - next_follow_up_at) as days_overdue
FROM work_items
WHERE next_follow_up_at < NOW()
  AND closed_at IS NULL
  AND is_waiting = false
ORDER BY next_follow_up_at ASC
LIMIT 20;
