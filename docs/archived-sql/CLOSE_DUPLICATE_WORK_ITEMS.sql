-- Close duplicate work items intelligently
-- Strategy: Keep the one with most activity (emails + files), close the empty ones

-- STEP 1: Preview which duplicates will be closed
WITH duplicate_analysis AS (
  SELECT
    wi.id,
    wi.customer_email,
    wi.customer_name,
    wi.created_at,
    wi.last_contact_at,
    (SELECT COUNT(*) FROM communications WHERE work_item_id = wi.id) as email_count,
    (SELECT COUNT(*) FROM files WHERE work_item_id = wi.id) as file_count,
    (SELECT COUNT(*) FROM work_item_status_events WHERE work_item_id = wi.id) as status_change_count,
    ROW_NUMBER() OVER (
      PARTITION BY wi.customer_email
      ORDER BY
        (SELECT COUNT(*) FROM communications WHERE work_item_id = wi.id) DESC,
        (SELECT COUNT(*) FROM files WHERE work_item_id = wi.id) DESC,
        wi.last_contact_at DESC NULLS LAST,
        wi.created_at DESC
    ) as activity_rank
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
)
SELECT
  id,
  customer_email,
  customer_name,
  created_at,
  email_count,
  file_count,
  status_change_count,
  activity_rank,
  CASE
    WHEN activity_rank = 1 THEN '✓ KEEP'
    ELSE '✗ CLOSE'
  END as action
FROM duplicate_analysis
ORDER BY customer_email, activity_rank;

-- STEP 2: Close the duplicates (the ones with activity_rank > 1)
-- Uncomment to execute:
/*
WITH duplicate_analysis AS (
  SELECT
    wi.id,
    wi.customer_email,
    (SELECT COUNT(*) FROM communications WHERE work_item_id = wi.id) as email_count,
    (SELECT COUNT(*) FROM files WHERE work_item_id = wi.id) as file_count,
    ROW_NUMBER() OVER (
      PARTITION BY wi.customer_email
      ORDER BY
        (SELECT COUNT(*) FROM communications WHERE work_item_id = wi.id) DESC,
        (SELECT COUNT(*) FROM files WHERE work_item_id = wi.id) DESC,
        wi.last_contact_at DESC NULLS LAST,
        wi.created_at DESC
    ) as activity_rank
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
),
keeper_ids AS (
  SELECT
    customer_email,
    id as keeper_id
  FROM duplicate_analysis
  WHERE activity_rank = 1
)
UPDATE work_items wi
SET
  closed_at = NOW(),
  close_reason = CONCAT('Duplicate work item - consolidated with ', (SELECT keeper_id FROM keeper_ids k WHERE k.customer_email = wi.customer_email)),
  updated_at = NOW()
FROM duplicate_analysis da
WHERE wi.id = da.id
  AND da.activity_rank > 1;
*/

-- STEP 3: Special case - merge files and emails from duplicate to keeper
-- For cases where BOTH duplicates have activity, transfer everything to the keeper
-- Run this BEFORE closing duplicates if needed
/*
WITH duplicate_analysis AS (
  SELECT
    wi.id,
    wi.customer_email,
    (SELECT COUNT(*) FROM communications WHERE work_item_id = wi.id) as email_count,
    (SELECT COUNT(*) FROM files WHERE work_item_id = wi.id) as file_count,
    ROW_NUMBER() OVER (
      PARTITION BY wi.customer_email
      ORDER BY
        (SELECT COUNT(*) FROM communications WHERE work_item_id = wi.id) DESC,
        (SELECT COUNT(*) FROM files WHERE work_item_id = wi.id) DESC,
        wi.last_contact_at DESC NULLS LAST,
        wi.created_at DESC
    ) as activity_rank
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
),
keeper_map AS (
  SELECT
    wi.id as duplicate_id,
    (SELECT id FROM duplicate_analysis WHERE customer_email = wi.customer_email AND activity_rank = 1) as keeper_id
  FROM work_items wi
  WHERE wi.id IN (SELECT id FROM duplicate_analysis WHERE activity_rank > 1)
)
-- Transfer communications
UPDATE communications c
SET work_item_id = km.keeper_id
FROM keeper_map km
WHERE c.work_item_id = km.duplicate_id;

-- Transfer files (run separately if needed)
-- UPDATE files f
-- SET work_item_id = km.keeper_id
-- FROM keeper_map km
-- WHERE f.work_item_id = km.duplicate_id;
*/

-- STEP 4: Verify the cleanup
SELECT
  customer_email,
  COUNT(*) as remaining_work_items,
  STRING_AGG(id::text, ', ') as work_item_ids
FROM work_items
WHERE closed_at IS NULL
  AND customer_email IN (
    'brett.young@outlook.com',
    'gayborinfo@gmail.com',
    'kandicehart4@gmail.com',
    'kaylacowins@gmail.com',
    'lifeinaflash001@gmail.com',
    'liztillman515@gmail.com',
    'megiegerich@gmail.com',
    'rod.t.santos221@gmail.com',
    'sammiebilly01@gmail.com',
    'sofiaflores2000@live.com'
  )
GROUP BY customer_email
ORDER BY customer_email;
