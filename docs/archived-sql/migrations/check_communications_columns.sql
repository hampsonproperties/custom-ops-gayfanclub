-- Check what columns actually exist in communications table
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'communications'
  AND table_schema = 'public'
ORDER BY ordinal_position;
