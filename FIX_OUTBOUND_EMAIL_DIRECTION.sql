-- ============================================================================
-- Fix Outbound Email Direction Detection
-- Purpose: Mark emails from ANY @thegayfanclub.com address as "outbound"
-- ============================================================================

-- Check current state
SELECT
  'BEFORE FIX' as status,
  direction,
  COUNT(*) as count
FROM communications
WHERE from_email LIKE '%@thegayfanclub.com'
GROUP BY direction;

-- Fix ALL emails from @thegayfanclub.com domain
UPDATE communications
SET direction = 'outbound'
WHERE from_email LIKE '%@thegayfanclub.com'
  AND direction = 'inbound';

-- Verify fix
SELECT
  'AFTER FIX' as status,
  direction,
  COUNT(*) as count
FROM communications
WHERE from_email LIKE '%@thegayfanclub.com'
GROUP BY direction;

-- Summary
DO $$
DECLARE
  outbound_count INTEGER;
  inbound_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO outbound_count
  FROM communications
  WHERE from_email LIKE '%@thegayfanclub.com'
    AND direction = 'outbound';

  SELECT COUNT(*) INTO inbound_count
  FROM communications
  WHERE from_email LIKE '%@thegayfanclub.com'
    AND direction = 'inbound';

  RAISE NOTICE '';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'Outbound Email Direction Fix Complete';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'All @thegayfanclub.com emails marked as outbound: %', outbound_count;
  RAISE NOTICE '@thegayfanclub.com emails still inbound: %', inbound_count;
  RAISE NOTICE '';

  IF inbound_count = 0 THEN
    RAISE NOTICE '✅ All company emails correctly marked as outbound!';
  ELSE
    RAISE NOTICE '⚠️  % company emails still marked as inbound', inbound_count;
  END IF;

  RAISE NOTICE '';
  RAISE NOTICE 'Applies to: sales@, support@, timothy@, ryan@, etc.';
  RAISE NOTICE 'Internal emails will now show with green arrows (↑)';
  RAISE NOTICE '========================================';
END $$;
