-- Add Apple Cash to notification filters
INSERT INTO email_filters (name, filter_type, pattern, target_category, is_active, reason)
VALUES
  ('Apple Cash/Pay', 'domain', 'insideapple.apple.com', 'notifications', true, 'Apple payment notifications'),
  ('Apple Cash', 'from_address', 'applecash@insideapple.apple.com', 'notifications', true, 'Apple Cash notifications')
ON CONFLICT (pattern, filter_type) DO UPDATE
SET
  target_category = EXCLUDED.target_category,
  is_active = EXCLUDED.is_active,
  reason = EXCLUDED.reason,
  updated_at = NOW();

-- Show result
SELECT * FROM email_filters WHERE pattern ILIKE '%apple%';
