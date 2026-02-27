# Database Migrations to Apply

Run these migrations in your Supabase SQL Editor to fix the 400 database errors:

## 1. Fix customer_notes schema mismatch

Run the contents of:
```
supabase/migrations/20260227000012_fix_customer_notes_schema.sql
```

This migration:
- Renames `note` column to `content`
- Adds `starred` boolean column
- Adds `is_internal` boolean column
- Ensures data is migrated safely

## 2. Add customer_id to communications

Run the contents of:
```
supabase/migrations/20260227000013_add_customer_id_to_communications.sql
```

This migration:
- Adds `customer_id` column to communications table
- Creates index for better query performance
- Backfills customer_id from work_items where available

## How to Apply

1. Go to your Supabase Dashboard: https://supabase.com/dashboard
2. Select your project
3. Navigate to SQL Editor
4. Copy the contents of each migration file above
5. Paste into SQL Editor and click "Run"
6. Verify with: `SELECT * FROM customer_notes LIMIT 1;` and `SELECT customer_id FROM communications LIMIT 1;`

## Errors These Fix

- ✅ Fixes 400 errors on `/rest/v1/customer_notes` queries
- ✅ Fixes 400/406 errors on `/rest/v1/communications?customer_id=` queries
- ✅ Allows customer activity feed to load properly

## Already Fixed in Code

- ✅ Changed GPT-4 to GPT-3.5-turbo (fixes 404 model access error)
- ✅ Improved error handling for OpenAI API

---

After running these migrations, redeploy your Vercel app to pick up the GPT-3.5-turbo model change.
