# Email Subscription Auto-Renewal - Deployment Guide

## What This Does

The system now automatically renews your email subscription whenever you (or anyone) logs into the dashboard. This ensures you never miss emails again!

**Key Features:**
- ✅ Auto-checks subscription on every dashboard login
- ✅ Renews if expired or expiring within 24 hours
- ✅ Automatically imports missed emails from last 3 days
- ✅ Silent background operation (doesn't slow down the dashboard)
- ✅ Runs once per session (not on every page change)

## Deployment Steps

### Step 1: Apply Database Migration

Go to your Supabase Dashboard → SQL Editor and run this:

```sql
-- Email Subscription Tracking
CREATE TABLE IF NOT EXISTS email_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  subscription_id text NOT NULL UNIQUE,
  resource text NOT NULL,
  notification_url text NOT NULL,
  expires_at timestamptz NOT NULL,
  created_at timestamptz DEFAULT now(),
  last_renewed_at timestamptz DEFAULT now(),
  status text DEFAULT 'active' CHECK (status IN ('active', 'expired', 'failed'))
);

CREATE INDEX idx_email_subscriptions_expires_at ON email_subscriptions(expires_at);
CREATE INDEX idx_email_subscriptions_status ON email_subscriptions(status);

COMMENT ON TABLE email_subscriptions IS 'Tracks Microsoft Graph email webhook subscriptions for auto-renewal';
```

### Step 2: Add Environment Variable to Vercel

Go to Vercel Dashboard → Your Project → Settings → Environment Variables

Add this variable:
```
NEXT_PUBLIC_APP_URL=https://custom-ops-gayfanclub.vercel.app
```

Make sure it's set for **Production** environment.

### Step 3: Deploy Code

The code changes are already in your local repo. Push to deploy:

```bash
git add .
git commit -m "Add email subscription auto-renewal on login"
git push
```

Vercel will automatically deploy.

### Step 4: Test It

1. Go to https://custom-ops-gayfanclub.vercel.app/dashboard
2. Open browser console (F12)
3. Look for logs like:
   - `✅ Email subscription renewed, expires: 2026-02-05...`
   - OR `✅ Email subscription active, expires: 2026-02-05...`

4. Verify in Supabase:
   ```sql
   SELECT * FROM email_subscriptions ORDER BY created_at DESC LIMIT 1;
   ```

## How It Works

```
User logs in → Dashboard loads → EmailSubscriptionManager runs
     ↓
Waits 2 seconds (non-blocking)
     ↓
Calls /api/email/check-subscription
     ↓
Checks database for active subscription
     ↓
If expired or < 24hrs remaining:
  - Deletes old subscription from Microsoft
  - Creates new subscription
  - Saves to database
  - Imports missed emails (last 3 days)
     ↓
Returns success (silently logged to console)
```

## Files Changed

- `supabase/migrations/20260202000001_add_email_subscriptions_table.sql` - New table
- `app/api/email/check-subscription/route.ts` - Smart check & renew endpoint
- `lib/hooks/use-email-subscription.ts` - Client hook
- `components/email/subscription-manager.tsx` - Silent component
- `app/(dashboard)/layout.tsx` - Added component to dashboard

## Manual Controls (if needed)

You still have manual control via the management script:

```bash
# Check subscription status
PRODUCTION_URL=https://custom-ops-gayfanclub.vercel.app \
  ./scripts/manage-email-subscription.sh check

# Force renewal
PRODUCTION_URL=https://custom-ops-gayfanclub.vercel.app \
  ./scripts/manage-email-subscription.sh renew

# Import missed emails
PRODUCTION_URL=https://custom-ops-gayfanclub.vercel.app \
  ./scripts/manage-email-subscription.sh import 14
```

## Benefits

1. **Zero maintenance** - Just login and it renews automatically
2. **Never miss emails** - Even if you don't login for days, first login catches up
3. **Transparent** - Console logs show what's happening
4. **Non-intrusive** - Runs in background, doesn't block UI
5. **Resilient** - Fails silently if something goes wrong (doesn't break dashboard)

## Monitoring

To check subscription status anytime:

```bash
curl https://custom-ops-gayfanclub.vercel.app/api/email/subscribe
```

Or check the database:
```sql
SELECT
  subscription_id,
  expires_at,
  expires_at - now() as time_remaining,
  status
FROM email_subscriptions
WHERE status = 'active'
ORDER BY expires_at DESC;
```

## Future Enhancements (Optional)

If you want even more reliability, you could add:
- Vercel Cron job that renews daily (backup to login-based renewal)
- Slack/email alerts if renewal fails
- Dashboard widget showing subscription status

But honestly, the login-based renewal should be perfect for your use case since you're actively using the system!
