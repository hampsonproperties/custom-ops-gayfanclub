-- ============================================================================
-- Backfill from_name for Existing Emails
-- Purpose: Extract names from email addresses for emails without from_name
-- ============================================================================

-- STEP 1: Show current state
SELECT
  'BEFORE BACKFILL' as status,
  COUNT(*) as total_emails,
  COUNT(*) FILTER (WHERE from_name IS NOT NULL) as with_names,
  COUNT(*) FILTER (WHERE from_name IS NULL) as without_names
FROM communications;

-- STEP 2: Backfill names by parsing email addresses
-- Converts "smith.veronda@gmail.com" → "Smith Veronda"
-- Converts "john_doe@example.com" → "John Doe"
UPDATE communications
SET from_name = INITCAP(
  REPLACE(
    REPLACE(
      REPLACE(
        SPLIT_PART(from_email, '@', 1),  -- Get part before @
        '.', ' '                          -- Replace dots with spaces
      ),
      '_', ' '                            -- Replace underscores with spaces
    ),
    '-', ' '                              -- Replace dashes with spaces
  )
)
WHERE from_name IS NULL
  AND from_email IS NOT NULL
  AND from_email != ''
  AND from_email NOT LIKE '%@thegayfanclub.com';  -- Don't parse company emails

-- STEP 3: For company emails, use the email prefix as-is
UPDATE communications
SET from_name = SPLIT_PART(from_email, '@', 1)
WHERE from_name IS NULL
  AND from_email LIKE '%@thegayfanclub.com';

-- STEP 4: Show results
SELECT
  'AFTER BACKFILL' as status,
  COUNT(*) as total_emails,
  COUNT(*) FILTER (WHERE from_name IS NOT NULL) as with_names,
  COUNT(*) FILTER (WHERE from_name IS NULL) as without_names
FROM communications;

-- STEP 5: Sample of backfilled names
SELECT
  from_email,
  from_name,
  subject
FROM communications
WHERE from_name IS NOT NULL
ORDER BY received_at DESC
LIMIT 10;

-- Summary
DO $$
DECLARE
  backfilled_count INTEGER;
  total_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO total_count FROM communications;
  SELECT COUNT(*) INTO backfilled_count FROM communications WHERE from_name IS NOT NULL;

  RAISE NOTICE '';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'Email Name Backfill Complete';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'Total emails: %', total_count;
  RAISE NOTICE 'Emails with names: %', backfilled_count;
  RAISE NOTICE 'Coverage: %%%', ROUND((backfilled_count::NUMERIC / total_count) * 100, 1);
  RAISE NOTICE '';
  RAISE NOTICE 'Note: Names are parsed from email addresses.';
  RAISE NOTICE 'smith.veronda@gmail.com → "Smith Veronda"';
  RAISE NOTICE 'Future emails will get real names from Microsoft Graph.';
  RAISE NOTICE '========================================';
END $$;
