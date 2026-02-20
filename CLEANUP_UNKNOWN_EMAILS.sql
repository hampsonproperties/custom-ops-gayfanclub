-- ============================================================================
-- Clean Up Unknown Sender Emails
-- Purpose: Remove/categorize emails with from_email = 'unknown@unknown.com'
-- ============================================================================

-- STEP 1: See what we're dealing with
SELECT
  COUNT(*) as total_unknown_emails,
  COUNT(*) FILTER (WHERE body_preview IS NULL OR body_preview = '') as empty_emails,
  COUNT(*) FILTER (WHERE subject IS NOT NULL AND subject != '(no subject)') as with_subject
FROM communications
WHERE from_email = 'unknown@unknown.com';

-- STEP 2: Delete completely empty junk emails
-- (no subject, no body, no sender - these are corrupted/draft emails)
DELETE FROM communications
WHERE from_email = 'unknown@unknown.com'
  AND (subject IS NULL OR subject = '(no subject)')
  AND (body_preview IS NULL OR body_preview = '' OR body_preview LIKE '%Ryan%Sales Support%');

-- STEP 3: Categorize remaining unknown emails as "notifications" (system notifications)
-- (e.g., Adobe PDF shares, calendar invites, etc.)
UPDATE communications
SET category = 'notifications'
WHERE from_email = 'unknown@unknown.com'
  AND category != 'notifications';

-- STEP 4: Verify cleanup
SELECT
  COUNT(*) as remaining_unknown_emails,
  category,
  COUNT(*) as count_by_category
FROM communications
WHERE from_email = 'unknown@unknown.com'
GROUP BY category;

-- STEP 5: Summary
DO $$
DECLARE
  deleted_count INTEGER;
  remaining_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO remaining_count
  FROM communications
  WHERE from_email = 'unknown@unknown.com';

  RAISE NOTICE '';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'Unknown Email Cleanup Complete';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'Remaining unknown emails: %', remaining_count;
  RAISE NOTICE '';

  IF remaining_count = 0 THEN
    RAISE NOTICE '✅ All unknown emails cleaned up!';
  ELSE
    RAISE NOTICE '⚠️  % unknown emails remain (categorized as notifications)', remaining_count;
  END IF;

  RAISE NOTICE '';
  RAISE NOTICE 'These will no longer show in your Primary inbox.';
  RAISE NOTICE '========================================';
END $$;
