# Custom Ops - Setup Guide

## Step-by-Step Setup Instructions

### 1. Create Supabase Project

1. Go to [supabase.com](https://supabase.com) and create a new project
2. Wait for the project to be created (takes ~2 minutes)
3. Once ready, go to **Settings → API** to get your credentials

### 2. Configure Environment Variables

1. Copy `.env.example` to `.env.local`:
   ```bash
   cp .env.example .env.local
   ```

2. Fill in your Supabase credentials in `.env.local`:
   ```env
   NEXT_PUBLIC_SUPABASE_URL=https://your-project-id.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-here
   SUPABASE_SERVICE_ROLE_KEY=your-service-role-key-here
   ```

### 3. Run Database Migrations

1. Open your Supabase project dashboard
2. Go to **SQL Editor**
3. Click **New Query**
4. Copy and paste the contents of each migration file **in order**:

   **Migration 1: Initial Schema**
   ```
   supabase/migrations/20260127000001_initial_schema.sql
   ```
   Click **Run** and wait for completion.

   **Migration 2: Seed Data**
   ```
   supabase/migrations/20260127000002_seed_data.sql
   ```
   Click **Run** and wait for completion.

   **Migration 3: RLS Policies**
   ```
   supabase/migrations/20260127000003_rls_policies.sql
   ```
   Click **Run** and wait for completion.

### 4. Create Your First User

1. In Supabase dashboard, go to **Authentication → Users**
2. Click **Add User → Create new user**
3. Enter:
   - Email: your-email@thegayfanclub.com
   - Password: (choose a strong password)
   - Auto Confirm User: **Yes**
4. Click **Create User**
5. Copy the User ID (you'll need this next)

### 5. Assign Admin Role to User

1. Go to **SQL Editor**
2. Run this query (replace YOUR_USER_ID with the ID from step 4):

```sql
-- Get the admin role ID
SELECT id FROM roles WHERE key = 'admin';

-- This will return the admin role UUID. Copy it.
-- Then run this query, replacing both placeholders:

INSERT INTO users (id, email, full_name, role_id)
VALUES (
  'YOUR_USER_ID',  -- Paste the user ID from step 4
  'your-email@thegayfanclub.com',  -- Your email
  'Your Name',  -- Your full name
  'ADMIN_ROLE_ID'  -- Paste the admin role ID from the first query
);
```

### 6. Install Dependencies & Run

```bash
npm install
npm run dev
```

### 7. Login

1. Open [http://localhost:3000](http://localhost:3000)
2. You'll be redirected to `/login`
3. Enter your email and password
4. You should be logged in and see the Dashboard!

## Testing the Application

### Test Email Intake Queue

Since we don't have real email integration yet, you can manually insert test emails:

```sql
INSERT INTO communications (
  direction,
  from_email,
  to_emails,
  subject,
  body_preview,
  triage_status,
  received_at
)
VALUES (
  'inbound',
  'customer@example.com',
  ARRAY['custom@thegayfanclub.com'],
  'Custom fans for wedding',
  'Hi! We are getting married in June and would love 100 custom fans for our guests...',
  'untriaged',
  NOW()
);
```

Then go to **/email-intake** and you should see the email!

### Test Design Review Queue

Manually insert a test Customify order:

```sql
INSERT INTO work_items (
  type,
  source,
  status,
  customer_name,
  customer_email,
  quantity,
  grip_color,
  shopify_order_number,
  design_preview_url
)
VALUES (
  'customify_order',
  'shopify',
  'needs_design_review',
  'Alex Smith',
  'alex@example.com',
  50,
  'Natural',
  '#1234',
  'https://via.placeholder.com/300'
);
```

Then go to **/design-queue** and you should see the order ready for review!

## Shopify Webhook Setup (Production)

1. In Shopify Admin, go to **Settings → Notifications → Webhooks**
2. Create webhooks for:
   - **orders/create** → `https://your-app.vercel.app/api/webhooks/shopify`
   - **orders/updated** → `https://your-app.vercel.app/api/webhooks/shopify`
   - **orders/fulfilled** → `https://your-app.vercel.app/api/webhooks/shopify`
3. Set webhook format to **JSON**
4. Save your webhook secret to `.env.local`:
   ```
   SHOPIFY_WEBHOOK_SECRET=your-webhook-secret
   ```

## Microsoft 365 Email (Future)

Email integration will require:
1. Azure AD app registration
2. Microsoft Graph API permissions
3. OAuth flow implementation

This is stubbed for now - emails can be manually inserted for testing.

## Deployment to Vercel

1. Push your code to GitHub
2. Go to [vercel.com](https://vercel.com) and import your repo
3. Add all environment variables from `.env.local`
4. Deploy!
5. Update Shopify webhooks to point to your Vercel URL

## Troubleshooting

### "Row Level Security" errors

Make sure you ran all 3 migration files in order. RLS policies are in the third migration.

### "User not found" after login

Make sure you created the user record in the `users` table (step 5) with the same ID as your auth user.

### Styles not loading

Clear your `.next` cache:
```bash
rm -rf .next
npm run dev
```

### Can't see any data

Check the browser console and Network tab for errors. Most likely an RLS policy issue or missing environment variable.

## Next Steps

Once you've verified the basic app works:

1. **Add real data** - Start triaging real emails and creating work items
2. **Test workflows** - Go through the full flow of: email → create lead → change status → review design
3. **Connect Shopify** - Set up webhooks to start receiving real orders
4. **Build batch functionality** - Implement the batch builder
5. **Add email sending** - Integrate Microsoft Graph API for sending emails
6. **Polish UI** - Adjust colors, spacing, add more status indicators

## Support

For issues or questions:
- Check the README.md for architecture details
- Review the PRD (IMPLEMENTATION_PLAN.md) for feature specs
- Open an issue on GitHub

---

**Built with 🌈 by The Gay Fan Club**
