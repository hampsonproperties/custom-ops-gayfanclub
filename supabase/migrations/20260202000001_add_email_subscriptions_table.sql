-- Email Subscription Tracking
-- Stores Microsoft Graph subscription info for auto-renewal

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

-- Index for quick expiration checks
CREATE INDEX idx_email_subscriptions_expires_at ON email_subscriptions(expires_at);
CREATE INDEX idx_email_subscriptions_status ON email_subscriptions(status);

-- Add comment
COMMENT ON TABLE email_subscriptions IS 'Tracks Microsoft Graph email webhook subscriptions for auto-renewal';
