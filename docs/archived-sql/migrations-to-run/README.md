# Run These Migrations in Order

Open your Supabase Dashboard SQL Editor:
👉 https://supabase.com/dashboard/project/uvdaqjxmstbhfcgjlemm/sql/new

Then run each file below **one at a time** in this order:

## Step 1: Email Deduplication
Open: `01_email_deduplication.sql`
- Copy all contents
- Paste into SQL Editor
- Click **Run**
- ✅ Wait for success message

## Step 2: Dead Letter Queue
Open: `02_dead_letter_queue.sql`
- Copy all contents
- Paste into SQL Editor
- Click **Run**
- ✅ Wait for success message

## Step 3: Stuck Items Views
Open: `03_stuck_items.sql`
- Copy all contents
- Paste into SQL Editor
- Click **Run**
- ✅ Wait for success message

## Step 4: Email Filters
Open: `04_email_filters.sql`
- Copy all contents
- Paste into SQL Editor
- Click **Run**
- ✅ Wait for success message

## Step 5: Conversations Table
Open: `05_conversations.sql`
- Copy all contents
- Paste into SQL Editor
- Click **Run**
- ✅ Wait for success message

## Step 6: Reminder Engine
Open: `06_reminder_engine.sql`
- Copy all contents
- Paste into SQL Editor
- Click **Run**
- ✅ Wait for success message

## Step 7: Quick Reply Templates
Open: `07_quick_replies.sql`
- Copy all contents
- Paste into SQL Editor
- Click **Run**
- ✅ Wait for success message

---

## All Done? ✅

Restart your app:
```bash
cd custom-ops
npm run dev
```

Then check:
- `/dashboard` - See new features
- `/stuck-items` - View stuck work items
- `/customers/[id]` - Customer profiles
