-- Verify form submissions were NOT affected
SELECT
  'FORM SUBMISSIONS - Should be UNTOUCHED' as check_type,
  id,
  customer_email,
  title,
  status,
  closed_at
FROM work_items
WHERE customer_email ILIKE '%powerfulform.com%'
   OR customer_email ILIKE '%forms-noreply@google.com%'
ORDER BY created_at DESC
LIMIT 20;

-- Show summary of work items by status
SELECT
  'SUMMARY BY STATUS' as report,
  status,
  COUNT(*) as count
FROM work_items
WHERE created_at > NOW() - INTERVAL '90 days'
GROUP BY status
ORDER BY count DESC;
