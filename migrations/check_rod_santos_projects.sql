-- Check all work_items for Rod Santos to understand the 3 projects shown

-- 1. All projects for Rod Santos
SELECT
  'All Rod Santos Projects' as section,
  id,
  title,
  shopify_order_number,
  design_fee_order_number,
  status,
  type,
  created_at,
  closed_at IS NOT NULL as is_closed
FROM work_items
WHERE customer_id = '58b16503-54cd-4cfe-b28e-8e835997780b'
ORDER BY created_at DESC;

-- 2. Check if any have the same order numbers
SELECT
  'Order Number Duplicates' as section,
  COALESCE(shopify_order_number, design_fee_order_number, '(no order number)') as order_num,
  COUNT(*) as count,
  ARRAY_AGG(id) as work_item_ids,
  ARRAY_AGG(status) as statuses,
  ARRAY_AGG(closed_at IS NOT NULL) as closed_flags
FROM work_items
WHERE customer_id = '58b16503-54cd-4cfe-b28e-8e835997780b'
GROUP BY COALESCE(shopify_order_number, design_fee_order_number, '(no order number)')
ORDER BY count DESC;

-- 3. Specific check for #6490 in any field
SELECT
  'Projects with 6490 in any field' as section,
  id,
  shopify_order_number,
  design_fee_order_number,
  shopify_order_id,
  design_fee_order_id,
  status,
  closed_at
FROM work_items
WHERE customer_id = '58b16503-54cd-4cfe-b28e-8e835997780b'
  AND (
    shopify_order_number LIKE '%6490%'
    OR design_fee_order_number LIKE '%6490%'
    OR shopify_order_id LIKE '%6490%'
  )
ORDER BY created_at DESC;

-- 4. Check for projects WITHOUT closed_at filter
SELECT
  'Active Projects Only' as section,
  id,
  title,
  shopify_order_number,
  status,
  created_at
FROM work_items
WHERE customer_id = '58b16503-54cd-4cfe-b28e-8e835997780b'
  AND closed_at IS NULL
ORDER BY created_at DESC;
