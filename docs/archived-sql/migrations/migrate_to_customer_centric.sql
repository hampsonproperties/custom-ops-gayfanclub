-- MIGRATION: Complete Customer-Centric Architecture
-- =================================================================
-- This migration creates customer records from work_items and links everything together
-- Run this ONCE to complete the PDR V4 customer-centric architecture

BEGIN;

-- Step 1: Create customers from work_items that have email but no customer_id
-- Use INSERT ... ON CONFLICT to avoid duplicates
INSERT INTO customers (email, display_name, source, created_at)
SELECT DISTINCT ON (LOWER(wi.customer_email))
  LOWER(wi.customer_email) as email,
  COALESCE(
    NULLIF(wi.customer_name, wi.customer_email),  -- Don't use email as name
    NULLIF(wi.customer_name, ''),
    wi.customer_email  -- Fallback to email if no name
  ) as display_name,
  'work_item_migration' as source,
  MIN(wi.created_at) as created_at
FROM work_items wi
WHERE wi.customer_id IS NULL
  AND wi.customer_email IS NOT NULL
  AND wi.customer_email != ''
  AND NOT EXISTS (
    SELECT 1 FROM customers c
    WHERE LOWER(c.email) = LOWER(wi.customer_email)
  )
GROUP BY LOWER(wi.customer_email), wi.customer_name
ORDER BY LOWER(wi.customer_email), MIN(wi.created_at);

-- Step 2: Link work_items to customers by email match
UPDATE work_items wi
SET customer_id = c.id
FROM customers c
WHERE wi.customer_id IS NULL
  AND LOWER(wi.customer_email) = LOWER(c.email)
  AND c.email IS NOT NULL;

-- Step 3: Backfill communications with customer_id from work_items
UPDATE communications comm
SET customer_id = wi.customer_id
FROM work_items wi
WHERE comm.work_item_id = wi.id
  AND comm.customer_id IS NULL
  AND wi.customer_id IS NOT NULL;

-- Step 4: Link remaining communications by email address
-- Inbound emails: match from_email
UPDATE communications c
SET customer_id = cust.id
FROM customers cust
WHERE c.customer_id IS NULL
  AND c.direction = 'inbound'
  AND LOWER(c.from_email) = LOWER(cust.email)
  AND cust.email IS NOT NULL;

-- Outbound emails: match to_emails array
UPDATE communications c
SET customer_id = cust.id
FROM customers cust
WHERE c.customer_id IS NULL
  AND c.direction = 'outbound'
  AND cust.email = ANY(c.to_emails)
  AND cust.email IS NOT NULL;

COMMIT;

-- Report results
SELECT '=== MIGRATION COMPLETE ===' as status;

SELECT
  'Customers' as table_name,
  COUNT(*) as total_records,
  COUNT(CASE WHEN source = 'work_item_migration' THEN 1 END) as created_by_migration
FROM customers;

SELECT
  'Work Items' as table_name,
  COUNT(*) as total_records,
  COUNT(customer_id) as linked_to_customers,
  COUNT(*) - COUNT(customer_id) as missing_customer
FROM work_items;

SELECT
  'Communications' as table_name,
  direction,
  COUNT(*) as total,
  COUNT(customer_id) as linked_to_customers,
  COUNT(*) - COUNT(customer_id) as missing_customer,
  ROUND(100.0 * COUNT(customer_id) / COUNT(*), 1) as percent_linked
FROM communications
GROUP BY direction
ORDER BY direction;

-- Show sample of newly created customers
SELECT
  'Newly Created Customers' as section,
  email,
  display_name,
  created_at
FROM customers
WHERE source = 'work_item_migration'
ORDER BY created_at DESC
LIMIT 10;
