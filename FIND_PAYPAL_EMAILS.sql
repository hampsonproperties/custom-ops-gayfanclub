-- ============================================================================
-- Find PayPal and System Emails
-- Purpose: See what notification emails are getting through as "primary"
-- ============================================================================

-- Find all PayPal-related communications
SELECT
  'PAYPAL EMAILS' as type,
  id,
  from_email,
  from_name,
  subject,
  category,
  triage_status,
  work_item_id,
  created_at
FROM communications
WHERE from_email ILIKE '%paypal%'
ORDER BY created_at DESC
LIMIT 20;

-- Find all work items created from PayPal emails
SELECT
  'PAYPAL WORK ITEMS' as type,
  wi.id,
  wi.customer_name,
  wi.customer_email,
  wi.title,
  wi.status,
  wi.source,
  wi.created_at,
  wi.reason_included
FROM work_items wi
WHERE wi.customer_email ILIKE '%paypal%'
   OR wi.customer_name ILIKE '%paypal%'
ORDER BY wi.created_at DESC;

-- Find all "primary" category emails from system domains
SELECT
  'PRIMARY CATEGORY SYSTEM EMAILS' as type,
  from_email,
  subject,
  category,
  work_item_id,
  created_at
FROM communications
WHERE category = 'primary'
  AND (
    from_email ILIKE '%@paypal.com%'
    OR from_email ILIKE '%@stripe.com%'
    OR from_email ILIKE '%@shopify.com%'
    OR from_email ILIKE '%noreply%'
    OR from_email ILIKE '%no-reply%'
    OR from_email ILIKE '%notifications@%'
  )
ORDER BY created_at DESC
LIMIT 50;

-- Count work items by source email domain
SELECT
  'WORK ITEMS BY DOMAIN' as type,
  SPLIT_PART(customer_email, '@', 2) as domain,
  COUNT(*) as count,
  STRING_AGG(DISTINCT status, ', ') as statuses
FROM work_items
WHERE closed_at IS NULL
  AND customer_email IS NOT NULL
GROUP BY SPLIT_PART(customer_email, '@', 2)
HAVING COUNT(*) > 1
ORDER BY count DESC
LIMIT 20;
