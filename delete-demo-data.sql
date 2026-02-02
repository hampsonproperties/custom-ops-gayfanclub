-- Delete demo work items (orders #1001, #1002, #1003)
DELETE FROM work_items
WHERE shopify_order_number IN ('#1001', '#1002', '#1003')
   OR customer_name IN ('Jamie Chen', 'Taylor Martinez', 'Morgan Davis');

-- Check what's left
SELECT
  id,
  customer_name,
  shopify_order_number,
  status,
  created_at
FROM work_items
ORDER BY created_at DESC
LIMIT 10;
