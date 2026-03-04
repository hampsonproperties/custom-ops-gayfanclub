-- Link all emails in a thread when one email is already linked to a work item
-- This ensures you see the full conversation, not just individual emails

-- STEP 1: Preview which emails will be linked
SELECT
  wi.id as work_item_id,
  wi.customer_name,
  c_linked.subject as already_linked_subject,
  c_unlinked.id as unlinked_email_id,
  c_unlinked.subject as unlinked_subject,
  c_unlinked.from_email,
  c_unlinked.received_at,
  c_unlinked.provider_thread_id
FROM work_items wi
JOIN communications c_linked ON c_linked.work_item_id = wi.id
JOIN communications c_unlinked ON
  c_unlinked.provider_thread_id = c_linked.provider_thread_id
  AND c_unlinked.work_item_id IS NULL
  AND c_unlinked.provider_thread_id IS NOT NULL
WHERE wi.closed_at IS NULL
ORDER BY wi.customer_name, c_unlinked.received_at;

-- STEP 2: Link all emails in the same thread
-- Uncomment to execute:
/*
UPDATE communications c_unlinked
SET
  work_item_id = wi.id,
  triage_status = 'attached',
  updated_at = NOW()
FROM work_items wi
JOIN communications c_linked ON c_linked.work_item_id = wi.id
WHERE c_unlinked.provider_thread_id = c_linked.provider_thread_id
  AND c_unlinked.work_item_id IS NULL
  AND c_unlinked.provider_thread_id IS NOT NULL
  AND wi.closed_at IS NULL;
*/

-- STEP 3: Verify - show how many emails each work item has now
SELECT
  wi.id,
  wi.customer_name,
  wi.customer_email,
  COUNT(c.id) as total_emails,
  COUNT(DISTINCT c.provider_thread_id) as unique_threads
FROM work_items wi
LEFT JOIN communications c ON c.work_item_id = wi.id
WHERE wi.closed_at IS NULL
  AND wi.customer_email IS NOT NULL
GROUP BY wi.id, wi.customer_name, wi.customer_email
HAVING COUNT(c.id) > 0
ORDER BY total_emails DESC;
