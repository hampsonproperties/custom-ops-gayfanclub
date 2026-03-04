-- Analyze what's showing up in the Leads section

-- 1. Count of work items by status (should only see sales statuses)
SELECT
  status,
  COUNT(*) as count,
  STRING_AGG(DISTINCT customer_email, ', ') as sample_emails
FROM work_items
WHERE closed_at IS NULL
  AND status IN ('new_inquiry', 'quote_sent', 'design_fee_sent', 'invoice_sent', 'awaiting_payment')
GROUP BY status
ORDER BY count DESC;

-- 2. Sample of work items that look like notifications/junk
SELECT
  id,
  customer_name,
  customer_email,
  title,
  status,
  source,
  created_at,
  reason_included->>'detected_via' as how_created
FROM work_items
WHERE closed_at IS NULL
  AND status IN ('new_inquiry', 'quote_sent', 'design_fee_sent', 'invoice_sent', 'awaiting_payment')
  AND (
    customer_email ILIKE '%noreply%' OR
    customer_email ILIKE '%no-reply%' OR
    customer_email ILIKE '%donotreply%' OR
    customer_email ILIKE '%paypal%' OR
    customer_email ILIKE '%stripe%' OR
    customer_email ILIKE '%shopify%' OR
    customer_email ILIKE '%etsy%' OR
    customer_email ILIKE '%amazon%' OR
    customer_email ILIKE '%apple%' OR
    customer_email ILIKE '%square%' OR
    customer_email ILIKE '%notifications%' OR
    customer_email ILIKE '%@alerts.%' OR
    customer_email ILIKE '%@info.%' OR
    customer_email ILIKE '%automated%'
  )
ORDER BY created_at DESC
LIMIT 50;

-- 3. Check which emails these work items are linked to
SELECT
  wi.customer_email,
  wi.customer_name,
  wi.status,
  COUNT(c.id) as email_count,
  STRING_AGG(DISTINCT c.category, ', ') as email_categories
FROM work_items wi
LEFT JOIN communications c ON c.work_item_id = wi.id
WHERE wi.closed_at IS NULL
  AND wi.status IN ('new_inquiry', 'quote_sent', 'design_fee_sent', 'invoice_sent', 'awaiting_payment')
GROUP BY wi.customer_email, wi.customer_name, wi.status
HAVING STRING_AGG(DISTINCT c.category, ', ') LIKE '%notification%'
  OR STRING_AGG(DISTINCT c.category, ', ') LIKE '%promotional%'
ORDER BY email_count DESC
LIMIT 50;

-- 4. Count by source to see where these are coming from
SELECT
  source,
  COUNT(*) as count
FROM work_items
WHERE closed_at IS NULL
  AND status IN ('new_inquiry', 'quote_sent', 'design_fee_sent', 'invoice_sent', 'awaiting_payment')
GROUP BY source
ORDER BY count DESC;
