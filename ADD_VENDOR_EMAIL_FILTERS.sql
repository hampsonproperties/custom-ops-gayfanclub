-- ============================================================================
-- Add Email Filters for Vendors and Service Emails
-- Purpose: Auto-categorize vendor/service emails as "notifications"
--          so they don't create work items
-- ============================================================================

-- Add filters for common vendors and service emails
INSERT INTO email_filters (name, filter_type, pattern, target_category, is_active, reason)
VALUES
  -- Vendors
  ('TopDisplay (vendor)', 'domain', 'topdisplay.net', 'notifications', true, 'Display vendor'),
  ('Qing Yulan (vendor)', 'domain', 'qing-yulan.com', 'notifications', true, 'Manufacturing vendor'),
  ('Uline (vendor)', 'domain', 'uline.com', 'notifications', true, 'Supplies vendor'),

  -- Service providers
  ('TrademarkEngine', 'domain', 'trademarkengine.com', 'notifications', true, 'Trademark monitoring service'),

  -- Fraud alerts
  ('Chase Fraud Alerts', 'from_address', 'Chase@fraudalert.chase.com', 'notifications', true, 'Bank fraud alerts'),
  ('Instagram Security', 'from_address', 'security@mail.instagram.com', 'notifications', true, 'Instagram security alerts'),

  -- Amazon (additional patterns)
  ('Amazon do-not-reply', 'from_address', 'donotreply@amazon.com', 'notifications', true, 'Amazon system emails'),

  -- Etsy
  ('Etsy Support', 'from_address', 'support@etsy.com', 'notifications', true, 'Etsy payment/support notifications')

ON CONFLICT (pattern, filter_type) DO UPDATE
SET
  target_category = EXCLUDED.target_category,
  is_active = EXCLUDED.is_active,
  reason = EXCLUDED.reason,
  updated_at = NOW();

-- Show all notification filters
SELECT
  'NOTIFICATION FILTERS' as type,
  id,
  name,
  filter_type,
  pattern,
  target_category,
  is_active,
  created_at
FROM email_filters
WHERE target_category = 'notifications'
ORDER BY created_at DESC;
