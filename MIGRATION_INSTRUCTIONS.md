# Database Migration: Alternate Emails

## What This Does

Adds support for tracking multiple email addresses per customer. This allows emails from different addresses (e.g., personal vs work email) to automatically link to the same work item.

## Running the Migration

### Option 1: Via Supabase Studio SQL Editor (Recommended)

1. Go to your Supabase project: https://supabase.com/dashboard/project/uvdaqjxmstbhfcgjlemm
2. Navigate to **SQL Editor** in the left sidebar
3. Create a new query
4. Copy and paste the contents of `supabase/migrations/20260203000001_add_alternate_emails.sql`
5. Click **Run** to execute the migration

### Option 2: Via Supabase CLI

```bash
# If you have Supabase CLI installed
supabase db push
```

### Option 3: Via psql

```bash
psql "your-connection-string-here" < supabase/migrations/20260203000001_add_alternate_emails.sql
```

## What Gets Created

- **Column:** `work_items.alternate_emails` (TEXT[] array)
- **Index:** `idx_work_items_alternate_emails` (GIN index for fast searches)
- **Default value:** Empty array `'{}'`

## Verifying the Migration

After running the migration, you can verify it worked:

```sql
-- Check if column exists
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'work_items'
AND column_name = 'alternate_emails';

-- Test adding an alternate email
UPDATE work_items
SET alternate_emails = array['test@example.com']
WHERE id = 'some-work-item-id';
```

## Example Usage

### Adding an alternate email for Basil's work item:

```sql
UPDATE work_items
SET alternate_emails = array['delibellules.basil@gmail.com']
WHERE id = 'c0ae0c91-73c4-4d5c-9ef2-52cb86bede5e';
```

Now emails from either `basilzuzu@gmail.com` OR `delibellules.basil@gmail.com` will auto-link to this work item!

## Post-Migration

After running the migration:

1. Deploy the updated code (already done if you're reading this from main branch)
2. The UI will show an "Alternate Emails" section in work item details
3. Email linking will automatically check both primary and alternate emails
4. You can manually add `delibellules.basil@gmail.com` via the UI or SQL

## Rollback (if needed)

```sql
-- Remove the column
ALTER TABLE work_items DROP COLUMN IF EXISTS alternate_emails;

-- Remove the index
DROP INDEX IF EXISTS idx_work_items_alternate_emails;
```
