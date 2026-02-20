# Database Migration Instructions

## ⚠️ Important
The new migrations (Phase 1-3) need to be applied manually via the Supabase Dashboard because `supabase db push` attempts to re-run all historical migrations, which conflicts with your existing database.

## How to Apply Migrations

### Option 1: Supabase Dashboard (Recommended)

1. **Open Supabase Dashboard**
   - Go to: https://supabase.com/dashboard/project/uvdaqjxmstbhfcgjlemm
   - Navigate to: **SQL Editor** (left sidebar)

2. **Create New Query**
   - Click **"New Query"** button

3. **Copy the Migration SQL**
   - Open the file: `custom-ops/APPLY_NEW_MIGRATIONS.sql`
   - Copy the entire contents (2,284 lines)

4. **Paste and Run**
   - Paste into the SQL Editor
   - Click **"Run"** button (or press `Cmd+Enter`)

5. **Verify Success**
   - You should see success messages in the output panel
   - Check for any errors (red text)

## What These Migrations Do

### Migration 1: Email Deduplication
- Adds 3-strategy deduplication
- Creates monitoring views
- Fixes 37+ duplicate emails

### Migration 2: Dead Letter Queue
- Captures failed operations
- Automatic retry with exponential backoff

### Migration 3: Stuck Items Detection
- 9 SQL views for stuck work items
- Unified dashboard

### Migration 4: Email Filters
- Domain-based filtering
- Seeds 18 filters
- Fixes 59% miscategorization

### Migration 5: Conversations Table
- CRM model for email threading
- Backfills existing emails

### Migration 6: Auto-Reminder Engine
- Reminder templates and queue
- 4 seeded templates

### Migration 7: Quick Reply Templates
- 8 templates with keyboard shortcuts
- Solves 316 manual responses

## After Migration

1. Restart your application
2. Visit `/dashboard` to see new features
3. Check `/stuck-items` for stuck work items

