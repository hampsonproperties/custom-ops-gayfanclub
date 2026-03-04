-- Check if work_items have customer email/name data

-- 1. Work items without customers but WITH email data
SELECT
  'Work items with email but no customer' as metric,
  COUNT(*) as count
FROM work_items
WHERE customer_id IS NULL
  AND customer_email IS NOT NULL
  AND customer_email != '';

-- 2. Sample of work items that need customers created
SELECT
  id,
  customer_name,
  customer_email,
  title,
  status,
  created_at
FROM work_items
WHERE customer_id IS NULL
  AND customer_email IS NOT NULL
ORDER BY created_at DESC
LIMIT 10;

-- 3. Check for duplicate customer emails in work_items
SELECT
  customer_email,
  COUNT(*) as project_count,
  STRING_AGG(DISTINCT customer_name, ', ') as names_used
FROM work_items
WHERE customer_id IS NULL
  AND customer_email IS NOT NULL
GROUP BY customer_email
ORDER BY project_count DESC
LIMIT 10;
