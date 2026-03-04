-- DEDUPLICATION: Merge duplicate work_items for the same Shopify order
-- =================================================================
-- This migration finds work_items with the same shopify_order_number
-- and merges them, keeping the oldest one.

BEGIN;

-- Step 1: Identify duplicates
WITH duplicates AS (
  SELECT
    shopify_order_number,
    COUNT(*) as count,
    ARRAY_AGG(id ORDER BY created_at ASC) as work_item_ids,
    ARRAY_AGG(status ORDER BY created_at ASC) as statuses,
    ARRAY_AGG(created_at ORDER BY created_at ASC) as created_ats
  FROM work_items
  WHERE shopify_order_number IS NOT NULL
    AND closed_at IS NULL
  GROUP BY shopify_order_number
  HAVING COUNT(*) > 1
)
SELECT
  'Duplicate Work Items Found' as section,
  shopify_order_number as order_number,
  count as duplicate_count,
  work_item_ids,
  statuses,
  created_ats
FROM duplicates
ORDER BY count DESC, shopify_order_number;

-- Step 2: For each duplicate set, show what will be kept vs removed
WITH duplicates AS (
  SELECT
    shopify_order_number,
    ARRAY_AGG(id ORDER BY created_at ASC) as ids
  FROM work_items
  WHERE shopify_order_number IS NOT NULL
    AND closed_at IS NULL
  GROUP BY shopify_order_number
  HAVING COUNT(*) > 1
)
SELECT
  'Merge Plan' as section,
  wi.shopify_order_number,
  wi.id,
  wi.status,
  wi.created_at,
  CASE
    WHEN wi.id = (
      SELECT id FROM work_items
      WHERE shopify_order_number = wi.shopify_order_number
        AND closed_at IS NULL
      ORDER BY created_at ASC
      LIMIT 1
    ) THEN '✅ KEEP (oldest)'
    ELSE '❌ MERGE & DELETE'
  END as action,
  (SELECT COUNT(*) FROM communications WHERE work_item_id = wi.id) as email_count,
  (SELECT COUNT(*) FROM files WHERE work_item_id = wi.id) as file_count,
  (SELECT COUNT(*) FROM work_item_notes WHERE work_item_id = wi.id) as note_count
FROM work_items wi
WHERE wi.shopify_order_number IN (
  SELECT shopify_order_number FROM duplicates
)
  AND wi.closed_at IS NULL
ORDER BY wi.shopify_order_number, wi.created_at ASC;

-- Step 3: MANUAL MERGE INSTRUCTIONS
-- For each duplicate set, you need to:
-- 1. Keep the oldest work_item (first created)
-- 2. Move all communications, files, notes from duplicates to the kept one
-- 3. Close the duplicate work_items

-- Example for Order #6490 (adjust IDs based on results above):
--
-- -- Find the IDs
-- SELECT id, status, created_at
-- FROM work_items
-- WHERE shopify_order_number = '#6490'
-- ORDER BY created_at ASC;
--
-- -- Keep the oldest (e.g., 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa')
-- -- Merge from duplicates (e.g., 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'cccccccc-cccc-cccc-cccc-cccccccccccc')
--
-- -- Move communications
-- UPDATE communications
-- SET work_item_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'
-- WHERE work_item_id IN ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'cccccccc-cccc-cccc-cccc-cccccccccccc');
--
-- -- Move files
-- UPDATE files
-- SET work_item_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'
-- WHERE work_item_id IN ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'cccccccc-cccc-cccc-cccc-cccccccccccc');
--
-- -- Move notes
-- UPDATE work_item_notes
-- SET work_item_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'
-- WHERE work_item_id IN ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'cccccccc-cccc-cccc-cccc-cccccccccccc');
--
-- -- Close duplicates
-- UPDATE work_items
-- SET
--   closed_at = NOW(),
--   closed_reason = 'Duplicate - merged into older work_item'
-- WHERE id IN ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'cccccccc-cccc-cccc-cccc-cccccccccccc');

ROLLBACK; -- This script is read-only, just shows what needs to be done
