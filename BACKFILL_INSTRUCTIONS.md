# Email & Lead Backfill Instructions

This script will properly backfill your system to get it fully working.

## What It Does

**Step 1: Refetch Real Names from Microsoft Graph**
- Fetches "Veronda Robinson" instead of parsing "smith.veronda@gmail.com"
- Updates all existing emails with real sender names
- Processes up to 500 emails (can be run multiple times)

**Step 2: Auto-Create Leads**
- Creates work items for all primary emails without leads
- Links all emails from same sender to one lead
- Calculates follow-up dates
- Prevents duplicates (links to existing if found)

## How to Run

### 1. Make sure you have all environment variables

Check your `.env.local` file has:
```
NEXT_PUBLIC_SUPABASE_URL=...
SUPABASE_SERVICE_ROLE_KEY=...
MICROSOFT_TENANT_ID=...
MICROSOFT_CLIENT_ID=...
MICROSOFT_CLIENT_SECRET=...
```

### 2. Install tsx if needed

```bash
npm install -g tsx
```

### 3. Run the script

```bash
cd /Users/timothy/Cursor\ Apps/Gay\ Fan\ Club/custom-ops
npx tsx scripts/backfill-emails-and-leads.ts
```

### 4. Watch the progress

You'll see output like:
```
=== STEP 1: Refetching Real Names from Microsoft Graph ===

Found 156 emails without names. Fetching from Microsoft Graph...
✅ Updated: Veronda Robinson (smith.veronda@gmail.com)
✅ Updated: John Smith (john@example.com)
📝 Parsed: Service (service@ringcentral.com)

✅ Step 1 Complete: Updated 156 emails, skipped 0

=== STEP 2: Auto-Creating Leads for Primary Emails ===

Found 45 primary emails without leads. Creating work items...
✅ Created lead: Veronda Robinson (4 emails linked)
✅ Created lead: John Smith (2 emails linked)
🔗 Linked 3 emails to existing lead: Sarah Johnson

✅ Step 2 Complete: Created 25 leads, skipped 20

🎉 BACKFILL COMPLETE!
```

### 5. Refresh your inbox

Hard refresh your browser: **Cmd + Shift + R**

You should now see:
- Real names like "Veronda Robinson" with emails below
- Work item badges on emails that have leads
- No more "Create Lead" buttons on primary emails (they're auto-created)

## If You Have More Than 500 Emails

The script processes in batches. Just run it again:
```bash
npx tsx scripts/backfill-emails-and-leads.ts
```

It's safe to run multiple times - it skips already-processed emails.

## Troubleshooting

**"Missing Microsoft Graph credentials"**
- Make sure your `.env.local` has MICROSOFT_* variables
- Copy from production if needed

**"API error: 401"**
- Microsoft credentials expired
- Check Microsoft Azure portal

**"Error fetching emails"**
- Supabase connection issue
- Check SUPABASE_SERVICE_ROLE_KEY is correct

## After Running

Going forward:
- ✅ New emails automatically get real names
- ✅ New primary emails automatically create leads
- ✅ System "just works"
