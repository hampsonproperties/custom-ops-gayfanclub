-- Find duplicate work items for the same customer
-- These are cases where the same customer has multiple open work items

-- STEP 1: Find customers with multiple open work items
SELECT
  customer_email,
  customer_name,
  COUNT(*) as work_item_count,
  ARRAY_AGG(id ORDER BY created_at DESC) as work_item_ids,
  ARRAY_AGG(title ORDER BY created_at DESC) as titles,
  ARRAY_AGG(status ORDER BY created_at DESC) as statuses,
  ARRAY_AGG(created_at ORDER BY created_at DESC) as created_dates
FROM work_items
WHERE closed_at IS NULL
  AND customer_email IS NOT NULL
  AND customer_email != ''
GROUP BY customer_email, customer_name
HAVING COUNT(*) > 1
ORDER BY COUNT(*) DESC, customer_email;

-- STEP 2: Detailed view of duplicates for a specific customer
-- Replace 'customer@example.com' with actual email
/*
SELECT
  id,
  customer_name,
  customer_email,
  title,
  status,
  type,
  shopify_order_number,
  created_at,
  last_contact_at,
  next_follow_up_at
FROM work_items
WHERE customer_email = 'customer@example.com'
  AND closed_at IS NULL
ORDER BY created_at DESC;
*/

-- STEP 3: Check for specific duplicates mentioned by user
SELECT
  id,
  customer_name,
  customer_email,
  title,
  status,
  type,
  shopify_order_number,
  created_at,
  (SELECT COUNT(*) FROM communications WHERE work_item_id = work_items.id) as email_count
FROM work_items
WHERE id IN (
  '1efb8e81-0085-447a-872c-fdeba9e436eb',
  'faa42e63-7642-4235-a3cd-13f912216bbe'
)
ORDER BY created_at;

-- STEP 4: Strategy for merging duplicates
-- Option A: Keep the newest, close the older ones
/*
UPDATE work_items
SET
  closed_at = NOW(),
  close_reason = 'duplicate_work_item',
  updated_at = NOW()
WHERE id IN (
  -- Put IDs of work items to close here
  'older-work-item-id-1',
  'older-work-item-id-2'
);
*/

-- Option B: Keep the one with most activity (emails, files, etc.)
-- First, analyze which one to keep:
SELECT
  wi.id,
  wi.customer_email,
  wi.customer_name,
  wi.created_at,
  wi.last_contact_at,
  (SELECT COUNT(*) FROM communications WHERE work_item_id = wi.id) as email_count,
  (SELECT COUNT(*) FROM files WHERE work_item_id = wi.id) as file_count,
  (SELECT COUNT(*) FROM work_item_status_events WHERE work_item_id = wi.id) as status_change_count
FROM work_items wi
WHERE wi.customer_email IN (
  SELECT customer_email
  FROM work_items
  WHERE closed_at IS NULL
    AND customer_email IS NOT NULL
  GROUP BY customer_email
  HAVING COUNT(*) > 1
)
  AND wi.closed_at IS NULL
ORDER BY wi.customer_email, email_count DESC, file_count DESC;

-- STEP 5: Close duplicate with reason
-- After deciding which to close, run:
/*
UPDATE work_items
SET
  closed_at = NOW(),
  close_reason = 'Duplicate - merged with [WORK_ITEM_ID]',
  updated_at = NOW()
WHERE id = 'duplicate-work-item-id';
*/
