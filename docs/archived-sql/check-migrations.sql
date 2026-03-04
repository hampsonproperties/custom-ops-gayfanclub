-- Run this in Supabase SQL Editor to see which migrations are applied
SELECT name, inserted_at
FROM supabase_migrations.schema_migrations
WHERE name LIKE '20260219%'
ORDER BY name;
