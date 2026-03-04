-- ============================================================================
-- Add Common Notification Email Filters
-- Purpose: Auto-categorize Etsy, Stripe, PayPal, and other system emails as "other"
-- Run this in Supabase SQL Editor
-- ============================================================================

-- Check for existing filters first to avoid duplicates
DO $$
BEGIN
  -- Only insert if pattern doesn't already exist

  -- Etsy notifications
  IF NOT EXISTS (SELECT 1 FROM email_filters WHERE pattern = '@etsy.com') THEN
    INSERT INTO email_filters (filter_type, pattern, action, target_category, name, description, priority)
    VALUES ('domain', '@etsy.com', 'categorize', 'other', 'Etsy notifications', 'Order notifications from Etsy marketplace', 30);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM email_filters WHERE pattern = '@transaction.etsy.com') THEN
    INSERT INTO email_filters (filter_type, pattern, action, target_category, name, description, priority)
    VALUES ('domain', '@transaction.etsy.com', 'categorize', 'other', 'Etsy transactions', 'Transaction confirmation emails', 30);
  END IF;

  -- Payment processors
  IF NOT EXISTS (SELECT 1 FROM email_filters WHERE pattern = '@stripe.com') THEN
    INSERT INTO email_filters (filter_type, pattern, action, target_category, name, description, priority)
    VALUES ('domain', '@stripe.com', 'categorize', 'other', 'Stripe notifications', 'Payment processor notifications', 30);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM email_filters WHERE pattern = '@paypal.com') THEN
    INSERT INTO email_filters (filter_type, pattern, action, target_category, name, description, priority)
    VALUES ('domain', '@paypal.com', 'categorize', 'other', 'PayPal notifications', 'Payment confirmations', 30);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM email_filters WHERE pattern = '@square.com') THEN
    INSERT INTO email_filters (filter_type, pattern, action, target_category, name, description, priority)
    VALUES ('domain', '@square.com', 'categorize', 'other', 'Square notifications', 'Payment processor emails', 30);
  END IF;

  -- Business software
  IF NOT EXISTS (SELECT 1 FROM email_filters WHERE pattern = '@quickbooks.com') THEN
    INSERT INTO email_filters (filter_type, pattern, action, target_category, name, description, priority)
    VALUES ('domain', '@quickbooks.com', 'categorize', 'other', 'QuickBooks', 'Accounting software notifications', 30);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM email_filters WHERE pattern = '@xero.com') THEN
    INSERT INTO email_filters (filter_type, pattern, action, target_category, name, description, priority)
    VALUES ('domain', '@xero.com', 'categorize', 'other', 'Xero', 'Accounting software', 30);
  END IF;

  -- Development tools (if you use them)
  IF NOT EXISTS (SELECT 1 FROM email_filters WHERE pattern = '@github.com') THEN
    INSERT INTO email_filters (filter_type, pattern, action, target_category, name, description, priority)
    VALUES ('domain', '@github.com', 'categorize', 'other', 'GitHub', 'Code repository notifications', 30);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM email_filters WHERE pattern = '@vercel.com') THEN
    INSERT INTO email_filters (filter_type, pattern, action, target_category, name, description, priority)
    VALUES ('domain', '@vercel.com', 'categorize', 'other', 'Vercel', 'Deployment notifications', 30);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM email_filters WHERE pattern = '@supabase.com') THEN
    INSERT INTO email_filters (filter_type, pattern, action, target_category, name, description, priority)
    VALUES ('domain', '@supabase.com', 'categorize', 'other', 'Supabase', 'Database notifications', 30);
  END IF;

  -- Team communication
  IF NOT EXISTS (SELECT 1 FROM email_filters WHERE pattern = '@slack.com') THEN
    INSERT INTO email_filters (filter_type, pattern, action, target_category, name, description, priority)
    VALUES ('domain', '@slack.com', 'categorize', 'other', 'Slack', 'Team chat notifications', 30);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM email_filters WHERE pattern = '@asana.com') THEN
    INSERT INTO email_filters (filter_type, pattern, action, target_category, name, description, priority)
    VALUES ('domain', '@asana.com', 'categorize', 'other', 'Asana', 'Project management updates', 30);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM email_filters WHERE pattern = '@trello.com') THEN
    INSERT INTO email_filters (filter_type, pattern, action, target_category, name, description, priority)
    VALUES ('domain', '@trello.com', 'categorize', 'other', 'Trello', 'Project board updates', 30);
  END IF;

  -- Generic catch-alls
  IF NOT EXISTS (SELECT 1 FROM email_filters WHERE pattern = '@notifications.') THEN
    INSERT INTO email_filters (filter_type, pattern, action, target_category, name, description, priority)
    VALUES ('domain', '@notifications.', 'categorize', 'other', 'Generic notifications subdomain', 'Catches notifications.example.com style senders', 40);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM email_filters WHERE pattern = 'do-not-reply@') THEN
    INSERT INTO email_filters (filter_type, pattern, action, target_category, name, description, priority)
    VALUES ('domain', 'do-not-reply@', 'categorize', 'other', 'Do-not-reply senders', 'Automated system emails', 40);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM email_filters WHERE pattern = 'donotreply@') THEN
    INSERT INTO email_filters (filter_type, pattern, action, target_category, name, description, priority)
    VALUES ('domain', 'donotreply@', 'categorize', 'other', 'Donotreply senders', 'Automated system emails', 40);
  END IF;

  -- Marketing/newsletters that aren't spam but also not needed
  IF NOT EXISTS (SELECT 1 FROM email_filters WHERE pattern = '@newsletter.') THEN
    INSERT INTO email_filters (filter_type, pattern, action, target_category, name, description, priority)
    VALUES ('domain', '@newsletter.', 'categorize', 'promotional', 'Generic newsletters', 'Newsletter subdomain pattern', 50);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM email_filters WHERE pattern = '@marketing.') THEN
    INSERT INTO email_filters (filter_type, pattern, action, target_category, name, description, priority)
    VALUES ('domain', '@marketing.', 'categorize', 'promotional', 'Generic marketing', 'Marketing subdomain pattern', 50);
  END IF;

  RAISE NOTICE 'Notification filters added successfully!';
END $$;

-- Show results
SELECT
  name,
  pattern,
  target_category,
  priority,
  is_active,
  match_count
FROM email_filters
WHERE target_category IN ('other', 'promotional')
ORDER BY priority, name;

-- Summary
DO $$
DECLARE
  notification_count INTEGER;
  promotional_count INTEGER;
  total_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO notification_count FROM email_filters WHERE target_category = 'other';
  SELECT COUNT(*) INTO promotional_count FROM email_filters WHERE target_category = 'promotional';
  SELECT COUNT(*) INTO total_count FROM email_filters;

  RAISE NOTICE '';
  RAISE NOTICE 'Email Filter Summary';
  RAISE NOTICE '===================';
  RAISE NOTICE 'Total filters: %', total_count;
  RAISE NOTICE 'Notification filters (other): %', notification_count;
  RAISE NOTICE 'Promotional filters: %', promotional_count;
  RAISE NOTICE '';
  RAISE NOTICE 'These emails will be HIDDEN from "My Actions Today":';
  RAISE NOTICE '  ✓ Etsy, Stripe, PayPal';
  RAISE NOTICE '  ✓ Shopify, QuickBooks, Slack';
  RAISE NOTICE '  ✓ GitHub, Vercel, Supabase';
  RAISE NOTICE '  ✓ Generic noreply@ senders';
  RAISE NOTICE '';
  RAISE NOTICE 'Staff will ONLY see customer emails in their daily workflow!';
END $$;
