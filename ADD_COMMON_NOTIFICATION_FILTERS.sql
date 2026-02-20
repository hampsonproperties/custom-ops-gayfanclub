-- ============================================================================
-- Add Common Notification Email Filters
-- Purpose: Auto-categorize Etsy, Stripe, PayPal, and other system emails as "other"
-- Run this in Supabase SQL Editor
-- ============================================================================

-- Etsy notifications
INSERT INTO email_filters (filter_type, pattern, action, target_category, name, description, priority)
VALUES
  ('domain', '@etsy.com', 'categorize', 'other', 'Etsy notifications', 'Order notifications from Etsy marketplace', 30),
  ('domain', '@transaction.etsy.com', 'categorize', 'other', 'Etsy transactions', 'Transaction confirmation emails', 30)
ON CONFLICT (key) DO NOTHING;

-- Payment processors
INSERT INTO email_filters (key, filter_type, pattern, action, target_category, name, description, priority)
VALUES
  ('stripe_notifications', 'domain', '@stripe.com', 'categorize', 'other', 'Stripe notifications', 'Payment processor notifications', 30),
  ('paypal_notifications', 'domain', '@paypal.com', 'categorize', 'other', 'PayPal notifications', 'Payment confirmations', 30),
  ('square_notifications', 'domain', '@square.com', 'categorize', 'other', 'Square notifications', 'Payment processor emails', 30)
ON CONFLICT (key) DO NOTHING;

-- Business software
INSERT INTO email_filters (key, filter_type, pattern, action, target_category, name, description, priority)
VALUES
  ('quickbooks_notifications', 'domain', '@quickbooks.com', 'categorize', 'other', 'QuickBooks', 'Accounting software notifications', 30),
  ('xero_notifications', 'domain', '@xero.com', 'categorize', 'other', 'Xero', 'Accounting software', 30)
ON CONFLICT (key) DO NOTHING;

-- Development tools (if you use them)
INSERT INTO email_filters (key, filter_type, pattern, action, target_category, name, description, priority)
VALUES
  ('github_notifications', 'domain', '@github.com', 'categorize', 'other', 'GitHub', 'Code repository notifications', 30),
  ('vercel_notifications', 'domain', '@vercel.com', 'categorize', 'other', 'Vercel', 'Deployment notifications', 30),
  ('supabase_notifications', 'domain', '@supabase.com', 'categorize', 'other', 'Supabase', 'Database notifications', 30)
ON CONFLICT (key) DO NOTHING;

-- Team communication
INSERT INTO email_filters (key, filter_type, pattern, action, target_category, name, description, priority)
VALUES
  ('slack_notifications', 'domain', '@slack.com', 'categorize', 'other', 'Slack', 'Team chat notifications', 30),
  ('asana_notifications', 'domain', '@asana.com', 'categorize', 'other', 'Asana', 'Project management updates', 30),
  ('trello_notifications', 'domain', '@trello.com', 'categorize', 'other', 'Trello', 'Project board updates', 30)
ON CONFLICT (key) DO NOTHING;

-- Generic catch-alls
INSERT INTO email_filters (key, filter_type, pattern, action, target_category, name, description, priority)
VALUES
  ('generic_notifications_subdomain', 'domain', '@notifications.', 'categorize', 'other', 'Generic notifications subdomain', 'Catches notifications.example.com style senders', 40),
  ('do_not_reply_hyphen', 'domain', 'do-not-reply@', 'categorize', 'other', 'Do-not-reply senders', 'Automated system emails', 40),
  ('donotreply_nospace', 'domain', 'donotreply@', 'categorize', 'other', 'Donotreply senders', 'Automated system emails', 40)
ON CONFLICT (key) DO NOTHING;

-- Marketing/newsletters that aren't spam but also not needed
INSERT INTO email_filters (key, filter_type, pattern, action, target_category, name, description, priority)
VALUES
  ('generic_newsletter_subdomain', 'domain', '@newsletter.', 'categorize', 'promotional', 'Generic newsletters', 'Newsletter subdomain pattern', 50),
  ('generic_marketing_subdomain', 'domain', '@marketing.', 'categorize', 'promotional', 'Generic marketing', 'Marketing subdomain pattern', 50)
ON CONFLICT (key) DO NOTHING;

-- Check results
SELECT
  name,
  pattern,
  target_category,
  priority,
  is_active
FROM email_filters
WHERE target_category IN ('other', 'promotional')
ORDER BY priority, name;

-- Summary
DO $$
DECLARE
  notification_count INTEGER;
  promotional_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO notification_count FROM email_filters WHERE target_category = 'other';
  SELECT COUNT(*) INTO promotional_count FROM email_filters WHERE target_category = 'promotional';

  RAISE NOTICE 'Email Filter Setup Complete';
  RAISE NOTICE '===========================';
  RAISE NOTICE 'Notification filters: %', notification_count;
  RAISE NOTICE 'Promotional filters: %', promotional_count;
  RAISE NOTICE '';
  RAISE NOTICE 'These emails will be hidden from "My Actions Today":';
  RAISE NOTICE '  - Etsy, Stripe, PayPal (other)';
  RAISE NOTICE '  - Shopify, QuickBooks (other)';
  RAISE NOTICE '  - GitHub, Vercel, Slack (other)';
  RAISE NOTICE '  - Generic noreply@ senders (other)';
  RAISE NOTICE '';
  RAISE NOTICE 'Staff will ONLY see customer emails in "My Actions Today"!';
END $$;
