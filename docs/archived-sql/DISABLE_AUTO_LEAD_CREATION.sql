-- Add comprehensive notification filters to prevent auto-lead creation

INSERT INTO email_filters (name, filter_type, pattern, action, target_category, description, is_active, priority)
VALUES
  -- Payment processors
  ('PayPal domain', 'domain', 'paypal.com', 'categorize', 'notifications', 'Payment processor notifications', true, 10),
  ('Stripe domain', 'domain', 'stripe.com', 'categorize', 'notifications', 'Payment processor notifications', true, 10),
  ('Square domain', 'domain', 'square.com', 'categorize', 'notifications', 'Payment processor notifications', true, 10),
  ('Apple domain', 'domain', 'apple.com', 'categorize', 'notifications', 'Apple payment notifications', true, 10),
  ('Apple insideapple', 'domain', 'insideapple.apple.com', 'categorize', 'notifications', 'Apple Cash notifications', true, 10),

  -- E-commerce platforms
  ('Shopify domain', 'domain', 'shopify.com', 'categorize', 'notifications', 'E-commerce platform notifications', true, 10),
  ('Etsy domain', 'domain', 'etsy.com', 'categorize', 'notifications', 'E-commerce platform notifications', true, 10),
  ('Amazon domain', 'domain', 'amazon.com', 'categorize', 'notifications', 'E-commerce platform notifications', true, 10),

  -- No-reply patterns (use sender type for email addresses)
  ('No-reply 1', 'sender', 'noreply@', 'categorize', 'notifications', 'No-reply automated emails', true, 10),
  ('No-reply 2', 'sender', 'no-reply@', 'categorize', 'notifications', 'No-reply automated emails', true, 10),
  ('No-reply 3', 'sender', 'donotreply@', 'categorize', 'notifications', 'No-reply automated emails', true, 10),
  ('No-reply 4', 'sender', 'do-not-reply@', 'categorize', 'notifications', 'No-reply automated emails', true, 10),

  -- Common notification subdomains
  ('Notifications subdomain', 'sender', '@notifications.', 'categorize', 'notifications', 'Notification subdomain', true, 10),
  ('Alerts subdomain', 'sender', '@alerts.', 'categorize', 'notifications', 'Alert subdomain', true, 10),
  ('Security subdomain', 'sender', 'security@', 'categorize', 'notifications', 'Security alert subdomain', true, 10),
  ('Info subdomain', 'sender', '@info.', 'categorize', 'notifications', 'Info subdomain', true, 10)

ON CONFLICT (pattern, filter_type) DO UPDATE
SET
  action = EXCLUDED.action,
  target_category = EXCLUDED.target_category,
  description = EXCLUDED.description,
  is_active = EXCLUDED.is_active,
  priority = EXCLUDED.priority,
  updated_at = NOW();

-- Show all notification filters
SELECT name, filter_type, pattern, action, target_category, is_active, match_count
FROM email_filters
WHERE target_category = 'notifications'
ORDER BY name;
