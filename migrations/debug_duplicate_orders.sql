-- Investigate duplicate work_items for Order #6490

-- 1. Show all work_items for customer Rod Santos
SELECT
  'All Projects for Rod Santos' as section,
  id,
  title,
  shopify_order_number,
  status,
  customer_email,
  customer_id,
  created_at,
  updated_at
FROM work_items
WHERE customer_id = '58b16503-54cd-4cfe-b28e-8e835997780b'
ORDER BY created_at DESC;

-- 2. Show all work_items with Order #6490
SELECT
  'All Projects with Order #6490' as section,
  id,
  title,
  shopify_order_number,
  status,
  customer_email,
  customer_id,
  created_at,
  updated_at
FROM work_items
WHERE shopify_order_number = '6490'
ORDER BY created_at DESC;

-- 3. Check for duplicate order numbers across all customers
SELECT
  'Duplicate Order Numbers Across All Customers' as section,
  shopify_order_number,
  COUNT(*) as count,
  ARRAY_AGG(DISTINCT status) as statuses,
  ARRAY_AGG(DISTINCT customer_email) as emails
FROM work_items
WHERE shopify_order_number IS NOT NULL
GROUP BY shopify_order_number
HAVING COUNT(*) > 1
ORDER BY COUNT(*) DESC
LIMIT 20;

-- 4. Show details of the 3 specific projects in screenshot
SELECT
  'Details of Order #6490 Projects' as section,
  id,
  title,
  shopify_order_number,
  status,
  customer_email,
  customer_name,
  customer_id,
  source,
  created_at,
  updated_at,
  shopify_order_id,
  shopify_line_item_id
FROM work_items
WHERE shopify_order_number = '6490'
ORDER BY created_at DESC;
