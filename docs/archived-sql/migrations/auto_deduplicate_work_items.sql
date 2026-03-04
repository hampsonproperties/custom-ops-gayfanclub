-- AUTOMATIC DEDUPLICATION: Merge duplicate work_items for the same Shopify order
-- =================================================================
-- This migration automatically merges work_items with the same shopify_order_number
-- WARNING: This will modify data. Review deduplicate_work_items.sql first!

BEGIN;

-- For each duplicate set, keep the oldest and merge others into it
DO $$
DECLARE
  dup_record RECORD;
  kept_id UUID;
  dup_ids UUID[];
BEGIN
  -- Find all duplicate sets
  FOR dup_record IN
    SELECT
      shopify_order_number,
      ARRAY_AGG(id ORDER BY created_at ASC) as ids
    FROM work_items
    WHERE shopify_order_number IS NOT NULL
      AND closed_at IS NULL
    GROUP BY shopify_order_number
    HAVING COUNT(*) > 1
  LOOP
    -- First ID is the one we keep (oldest)
    kept_id := dup_record.ids[1];
    -- Rest are duplicates to merge
    dup_ids := dup_record.ids[2:array_length(dup_record.ids, 1)];

    RAISE NOTICE 'Order %: Keeping % and merging %', dup_record.shopify_order_number, kept_id, dup_ids;

    -- Move communications
    UPDATE communications
    SET work_item_id = kept_id
    WHERE work_item_id = ANY(dup_ids);

    -- Move files
    UPDATE files
    SET work_item_id = kept_id
    WHERE work_item_id = ANY(dup_ids);

    -- Move notes
    UPDATE work_item_notes
    SET work_item_id = kept_id
    WHERE work_item_id = ANY(dup_ids);

    -- Move status events
    UPDATE work_item_status_events
    SET work_item_id = kept_id
    WHERE work_item_id = ANY(dup_ids);

    -- Move customer orders
    UPDATE customer_orders
    SET work_item_id = kept_id
    WHERE work_item_id = ANY(dup_ids);

    -- Merge tags (avoid duplicates)
    INSERT INTO work_item_tag_links (work_item_id, tag_id)
    SELECT DISTINCT kept_id, tag_id
    FROM work_item_tag_links
    WHERE work_item_id = ANY(dup_ids)
    ON CONFLICT (work_item_id, tag_id) DO NOTHING;

    -- Delete duplicate tag links
    DELETE FROM work_item_tag_links
    WHERE work_item_id = ANY(dup_ids);

    -- Close the duplicate work_items
    UPDATE work_items
    SET
      closed_at = NOW(),
      closed_reason = 'Duplicate - merged into ' || kept_id::text
    WHERE id = ANY(dup_ids);

  END LOOP;
END $$;

-- Report results
SELECT
  'Deduplication Complete' as status;

SELECT
  'Remaining Work Items' as section,
  COUNT(*) as total,
  COUNT(CASE WHEN closed_at IS NOT NULL THEN 1 END) as closed,
  COUNT(CASE WHEN closed_at IS NULL THEN 1 END) as active
FROM work_items;

SELECT
  'Merged Work Items' as section,
  id,
  shopify_order_number,
  status,
  closed_reason,
  (SELECT COUNT(*) FROM communications WHERE work_item_id = work_items.id) as email_count,
  (SELECT COUNT(*) FROM files WHERE work_item_id = work_items.id) as file_count
FROM work_items
WHERE closed_reason LIKE 'Duplicate - merged into%'
ORDER BY closed_at DESC;

COMMIT;
