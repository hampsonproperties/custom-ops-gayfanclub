-- ============================================================================
-- Fix Support Category Filters
-- Purpose: Change filters with target_category='support' to 'primary'
--          (support is a triage_status, not a category)
-- ============================================================================

-- STEP 1: Show the 6 filters with 'support' category
SELECT
  'FILTERS WITH SUPPORT CATEGORY' as status,
  id,
  name,
  filter_type,
  pattern,
  target_category,
  description
FROM email_filters
WHERE target_category = 'support';

-- STEP 2: Fix by changing 'support' → 'primary'
-- These emails should be categorized as primary (customer emails)
-- The support queue will use triage_status='flagged_support' instead
UPDATE email_filters
SET target_category = 'primary'
WHERE target_category = 'support';

-- STEP 3: Verify - should show NO 'support' category
SELECT
  'AFTER FIX - Category Breakdown' as status,
  target_category,
  COUNT(*) as filter_count
FROM email_filters
GROUP BY target_category
ORDER BY
  CASE target_category
    WHEN 'primary' THEN 1
    WHEN 'promotional' THEN 2
    WHEN 'spam' THEN 3
    WHEN 'notifications' THEN 4
    ELSE 5
  END;

-- STEP 4: Summary
DO $$
DECLARE
  primary_count INTEGER;
  total_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO primary_count FROM email_filters WHERE target_category = 'primary';
  SELECT COUNT(*) INTO total_count FROM email_filters;

  RAISE NOTICE '';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'Support Category Fix Complete';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'Changed 6 filters from "support" → "primary"';
  RAISE NOTICE '';
  RAISE NOTICE 'Valid categories:';
  RAISE NOTICE '  ✓ primary (%), promotional, spam, notifications', primary_count;
  RAISE NOTICE '';
  RAISE NOTICE 'Note: Support emails use triage_status="flagged_support"';
  RAISE NOTICE '      not category="support"';
  RAISE NOTICE '========================================';
END $$;
