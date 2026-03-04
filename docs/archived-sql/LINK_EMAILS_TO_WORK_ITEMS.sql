-- Bulk link emails to work items based on customer email matching
-- This finds unlinked emails (work_item_id IS NULL) and links them to work items
-- where the customer_email matches either from_email or to_email

-- STEP 1: Preview what will be linked
SELECT
  wi.id as work_item_id,
  wi.customer_name,
  wi.customer_email,
  c.id as email_id,
  c.from_email,
  c.subject,
  c.received_at,
  c.direction
FROM work_items wi
JOIN communications c ON (
  c.work_item_id IS NULL
  AND (
    c.from_email = wi.customer_email
    OR c.to_email = wi.customer_email
  )
)
WHERE wi.closed_at IS NULL
  AND wi.customer_email IS NOT NULL
ORDER BY wi.customer_name, c.received_at DESC;

-- STEP 2: Run the update to link emails
-- Uncomment to execute:
/*
UPDATE communications c
SET
  work_item_id = wi.id,
  triage_status = 'attached',
  updated_at = NOW()
FROM work_items wi
WHERE c.work_item_id IS NULL
  AND wi.closed_at IS NULL
  AND wi.customer_email IS NOT NULL
  AND (
    c.from_email = wi.customer_email
    OR c.to_email = wi.customer_email
  );
*/

-- STEP 3: Also link based on alternate_emails array
-- Uncomment to execute:
/*
UPDATE communications c
SET
  work_item_id = wi.id,
  triage_status = 'attached',
  updated_at = NOW()
FROM work_items wi
WHERE c.work_item_id IS NULL
  AND wi.closed_at IS NULL
  AND wi.alternate_emails IS NOT NULL
  AND (
    c.from_email = ANY(wi.alternate_emails)
    OR c.to_email = ANY(wi.alternate_emails)
  );
*/

-- STEP 4: Verify results
SELECT
  wi.customer_name,
  wi.customer_email,
  COUNT(c.id) as linked_email_count
FROM work_items wi
LEFT JOIN communications c ON c.work_item_id = wi.id
WHERE wi.closed_at IS NULL
  AND wi.customer_email IS NOT NULL
GROUP BY wi.id, wi.customer_name, wi.customer_email
HAVING COUNT(c.id) > 0
ORDER BY linked_email_count DESC;
