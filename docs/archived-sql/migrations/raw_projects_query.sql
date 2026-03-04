-- Exact query that the frontend is running

SELECT
  id,
  type,
  title,
  status,
  shopify_order_number,
  event_date,
  created_at,
  updated_at,
  closed_at
FROM work_items
WHERE customer_id = '58b16503-54cd-4cfe-b28e-8e835997780b'
ORDER BY created_at DESC;
