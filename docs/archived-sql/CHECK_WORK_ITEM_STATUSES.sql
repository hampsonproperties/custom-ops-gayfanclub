-- Check what statuses exist and their counts
SELECT
  type,
  status,
  COUNT(*) as count
FROM work_items
WHERE closed_at IS NULL
GROUP BY type, status
ORDER BY type, count DESC;
