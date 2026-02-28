-- Debug why emails aren't matching customers

-- 1. Check total customers
SELECT 'Total customers' as metric, COUNT(*) as count
FROM customers;

-- 2. Check customers with emails
SELECT 'Customers with email' as metric, COUNT(*) as count
FROM customers
WHERE email IS NOT NULL AND email != '';

-- 3. Sample unlinked inbound emails
SELECT
  'Sample unlinked inbound emails' as section,
  from_email,
  from_name,
  subject,
  received_at
FROM communications
WHERE direction = 'inbound'
  AND customer_id IS NULL
ORDER BY received_at DESC
LIMIT 10;

-- 4. Check if any communication emails match customer emails (case-insensitive)
SELECT
  'Potential matches not linked' as section,
  c.from_email,
  cust.email as customer_email,
  cust.display_name,
  c.subject
FROM communications c
JOIN customers cust ON LOWER(c.from_email) = LOWER(cust.email)
WHERE c.direction = 'inbound'
  AND c.customer_id IS NULL
LIMIT 10;

-- 5. Check if emails are being stored differently
SELECT
  'Email format check' as section,
  from_email,
  LENGTH(from_email) as email_length,
  from_email = TRIM(from_email) as is_trimmed
FROM communications
WHERE direction = 'inbound'
  AND customer_id IS NULL
LIMIT 5;

-- 6. Check work_items that have customer_id
SELECT
  'Work items with customers' as metric,
  COUNT(*) as total_work_items,
  COUNT(customer_id) as with_customer_id,
  COUNT(*) - COUNT(customer_id) as missing_customer_id
FROM work_items;
