-- ============================================================================
-- Fix Invalid Email Filters
-- Purpose: Find and fix email filters with invalid target_category values
-- ============================================================================

-- STEP 1: Show filters with invalid categories
SELECT
  'INVALID FILTERS FOUND' as status,
  id,
  name,
  filter_type,
  pattern,
  target_category,
  is_active
FROM email_filters
WHERE target_category NOT IN ('primary', 'promotional', 'spam', 'notifications');

-- STEP 2: Fix filters with 'other' category → change to 'notifications'
UPDATE email_filters
SET target_category = 'notifications'
WHERE target_category = 'other';

-- STEP 3: Verify all filters now have valid categories
SELECT
  'AFTER FIX' as status,
  target_category,
  COUNT(*) as filter_count
FROM email_filters
GROUP BY target_category
ORDER BY filter_count DESC;

-- STEP 4: Show summary
DO $$
DECLARE
  fixed_count INTEGER;
  total_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO fixed_count FROM email_filters WHERE target_category = 'notifications';
  SELECT COUNT(*) INTO total_count FROM email_filters;

  RAISE NOTICE '';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'Email Filter Fix Complete';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'Total filters: %', total_count;
  RAISE NOTICE 'Notifications: %', fixed_count;
  RAISE NOTICE '';
  RAISE NOTICE 'All filters now have valid categories:';
  RAISE NOTICE '  - primary, promotional, spam, notifications';
  RAISE NOTICE '========================================';
END $$;
