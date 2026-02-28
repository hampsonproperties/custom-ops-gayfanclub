-- Debug specific customer: 58b16503-54cd-4cfe-b28e-8e835997780b

-- 1. Check customer record
SELECT
  'Customer Record' as section,
  id,
  email,
  display_name,
  created_at
FROM customers
WHERE id = '58b16503-54cd-4cfe-b28e-8e835997780b';

-- 2. Check work_items linked to this customer
SELECT
  'Work Items for Customer' as section,
  id,
  title,
  customer_email,
  shopify_order_number,
  status,
  created_at
FROM work_items
WHERE customer_id = '58b16503-54cd-4cfe-b28e-8e835997780b'
ORDER BY created_at DESC;

-- 3. Check communications linked to this customer
SELECT
  'Communications for Customer' as section,
  COUNT(*) as total_emails
FROM communications
WHERE customer_id = '58b16503-54cd-4cfe-b28e-8e835997780b';

-- 4. Check communications by customer email
SELECT
  'Communications by Email Match' as section,
  c.id,
  c.from_email,
  c.subject,
  c.customer_id,
  c.work_item_id,
  c.received_at
FROM communications c
WHERE c.from_email = (
  SELECT email FROM customers WHERE id = '58b16503-54cd-4cfe-b28e-8e835997780b'
)
OR (
  SELECT email FROM customers WHERE id = '58b16503-54cd-4cfe-b28e-8e835997780b'
) = ANY(c.to_emails)
ORDER BY c.received_at DESC
LIMIT 10;

-- 5. Check if customer email matches work_item emails
SELECT
  'Customer Email vs Work Item Emails' as section,
  cust.email as customer_email,
  wi.customer_email as work_item_email,
  LOWER(cust.email) = LOWER(wi.customer_email) as emails_match
FROM customers cust
LEFT JOIN work_items wi ON wi.customer_id = cust.id
WHERE cust.id = '58b16503-54cd-4cfe-b28e-8e835997780b'
LIMIT 5;
