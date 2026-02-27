# Database Migrations Required

The following migrations need to be applied to your Supabase database:

## 1. Enhanced Notes System (20260227000007_enhance_notes_system.sql)

This migration adds the following to the `work_item_notes` table:
- `starred` column (for favoriting notes)
- `created_by_user_id` column (for user tracking)
- `is_internal` column (for internal vs customer-facing notes)
- Indexes for performance
- Backfills user data from existing `author_email` column

## 2. Customer Contacts (20260227000008_create_customer_contacts.sql)

This migration creates the `customer_contacts` table for managing alternative contacts:
- Financial sponsors
- Co-chairs
- Decision makers
- Coordinators
- Other key contacts

Features:
- Full contact information (name, email, phone, role, title)
- Primary contact designation
- Email CC and invoice recipient flags
- Notes field for additional context

## How to Apply

### Option 1: Supabase SQL Editor (Recommended)

1. Go to your Supabase Dashboard: https://supabase.com/dashboard
2. Navigate to the SQL Editor
3. Run each migration file in order:

   **Step 1:** Copy and run `/supabase/migrations/20260227000007_enhance_notes_system.sql`

   **Step 2:** Copy and run `/supabase/migrations/20260227000008_create_customer_contacts.sql`

4. Click "Run" after pasting each migration

### Option 2: Supabase CLI (if migration history is fixed)

```bash
# First, mark all existing migrations as applied
supabase migration repair --status applied 20260227000006

# Then push the new migrations
supabase db push
```

## Verification

After applying the migrations, you can verify they worked by running:

```bash
node scripts/check-schema.mjs
```

You should see:
```
✅ customer_contacts table exists
✅ work_item_notes.starred column exists
```

## Impact

These migrations are required for the following features to work:
- Alternative Contacts Manager on customer detail pages
- Star/favorite functionality on notes
- Enhanced timeline with user attribution
- Internal vs customer-facing note distinction
