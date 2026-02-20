-- ============================================================================
-- Fix Outbound Email Direction Detection
-- Purpose: Mark emails from support@ and sales@ as "outbound" instead of "inbound"
-- ============================================================================

-- Check current state
SELECT
  'BEFORE FIX' as status,
  direction,
  COUNT(*) as count
FROM communications
WHERE from_email IN ('sales@thegayfanclub.com', 'support@thegayfanclub.com')
GROUP BY direction;

-- Fix emails from sales@thegayfanclub.com
UPDATE communications
SET direction = 'outbound'
WHERE from_email = 'sales@thegayfanclub.com'
  AND direction = 'inbound';

-- Fix emails from support@thegayfanclub.com
UPDATE communications
SET direction = 'outbound'
WHERE from_email = 'support@thegayfanclub.com'
  AND direction = 'inbound';

-- Verify fix
SELECT
  'AFTER FIX' as status,
  direction,
  COUNT(*) as count
FROM communications
WHERE from_email IN ('sales@thegayfanclub.com', 'support@thegayfanclub.com')
GROUP BY direction;

-- Summary
DO $$
DECLARE
  outbound_count INTEGER;
  inbound_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO outbound_count
  FROM communications
  WHERE from_email IN ('sales@thegayfanclub.com', 'support@thegayfanclub.com')
    AND direction = 'outbound';

  SELECT COUNT(*) INTO inbound_count
  FROM communications
  WHERE from_email IN ('sales@thegayfanclub.com', 'support@thegayfanclub.com')
    AND direction = 'inbound';

  RAISE NOTICE '';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'Outbound Email Direction Fix Complete';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'Company emails marked as outbound: %', outbound_count;
  RAISE NOTICE 'Company emails still inbound: %', inbound_count;
  RAISE NOTICE '';

  IF inbound_count = 0 THEN
    RAISE NOTICE '✅ All company emails correctly marked as outbound!';
  ELSE
    RAISE NOTICE '⚠️  % company emails still marked as inbound', inbound_count;
  END IF;

  RAISE NOTICE '';
  RAISE NOTICE 'Your sent emails will now show with green arrows (↑)';
  RAISE NOTICE '========================================';
END $$;
