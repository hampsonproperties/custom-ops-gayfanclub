-- Backfill customer_id for communications by matching email addresses
-- This links emails directly to customers when email addresses match

-- Strategy 1: Link via work_items (already done above)
-- Strategy 2: Link inbound emails by matching from_email to customer email
UPDATE communications c
SET customer_id = cust.id
FROM customers cust
WHERE c.customer_id IS NULL
  AND c.direction = 'inbound'
  AND LOWER(c.from_email) = LOWER(cust.email)
  AND cust.email IS NOT NULL;

-- Strategy 3: Link outbound emails by matching to_emails array to customer email
UPDATE communications c
SET customer_id = cust.id
FROM customers cust
WHERE c.customer_id IS NULL
  AND c.direction = 'outbound'
  AND cust.email = ANY(c.to_emails)
  AND cust.email IS NOT NULL;

-- Check results
SELECT
  'Backfill by email complete' as status,
  COUNT(*) as total_communications,
  COUNT(customer_id) as with_customer_id,
  COUNT(*) - COUNT(customer_id) as still_missing_customer_id,
  ROUND(100.0 * COUNT(customer_id) / COUNT(*), 1) as percent_linked
FROM communications;

-- Show breakdown by direction
SELECT
  direction,
  COUNT(*) as total,
  COUNT(customer_id) as with_customer_id,
  COUNT(*) - COUNT(customer_id) as missing_customer_id
FROM communications
GROUP BY direction
ORDER BY direction;
