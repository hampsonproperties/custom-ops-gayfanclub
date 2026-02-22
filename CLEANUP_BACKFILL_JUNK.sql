-- ============================================================================
-- Cleanup Junk Work Items from Backfill
-- Purpose: Close work items created from notification/system emails during backfill
-- ============================================================================

-- STEP 1: Preview what will be closed
SELECT
  'PREVIEW - JUNK WORK ITEMS FROM BACKFILL' as action,
  id,
  customer_name,
  customer_email,
  title,
  status,
  source,
  created_at,
  reason_included
FROM work_items
WHERE closed_at IS NULL
  AND (
    -- Backfilled items (from the backfill script)
    reason_included->>'detected_via' = 'backfill_script'
    OR reason_included->>'detected_via' = 'auto_lead_primary_category'
  )
  AND (
    -- PayPal (all variations)
    customer_email ILIKE '%paypal%'
    OR customer_name ILIKE '%paypal%'

    -- Stripe
    OR customer_email ILIKE '%stripe%'
    OR customer_name ILIKE '%stripe%'

    -- Shopify
    OR customer_email ILIKE '%shopify%'
    OR customer_name ILIKE '%shopify%'

    -- Square
    OR customer_email ILIKE '%square%'

    -- No-reply addresses
    OR customer_email ILIKE '%noreply%'
    OR customer_email ILIKE '%no-reply%'
    OR customer_email ILIKE '%donotreply%'
    OR customer_email ILIKE '%do-not-reply%'

    -- Notification domains
    OR customer_email ILIKE '%@notifications.%'
    OR customer_email ILIKE '%@alerts.%'
    OR customer_email ILIKE '%@marketing.%'
    OR customer_email ILIKE '%@newsletter.%'

    -- Etsy
    OR customer_email ILIKE '%etsy.com%'

    -- QuickBooks
    OR customer_email ILIKE '%quickbooks%'
    OR customer_email ILIKE '%intuit%'

    -- Other business software
    OR customer_email ILIKE '%asana%'
    OR customer_email ILIKE '%trello%'
    OR customer_email ILIKE '%slack%'
    OR customer_email ILIKE '%monday.com%'
    OR customer_email ILIKE '%zoom.us%'
    OR customer_email ILIKE '%calendly%'

    -- Document services
    OR customer_email ILIKE '%adobe%'
    OR customer_email ILIKE '%docusign%'
    OR customer_email ILIKE '%dropbox%'

    -- Email marketing
    OR customer_email ILIKE '%mailchimp%'
    OR customer_email ILIKE '%constantcontact%'
    OR customer_email ILIKE '%sendgrid%'
    OR customer_email ILIKE '%hubspot%'

    -- Transactional subjects
    OR title ILIKE '%receipt%'
    OR title ILIKE '%invoice from%'
    OR title ILIKE '%payment confirmation%'
    OR title ILIKE '%order confirmation%'
    OR title ILIKE '%tracking%'
    OR title ILIKE '%you sent%payment%'
    OR title ILIKE '%you have a payment%'
  )
ORDER BY created_at DESC;

-- STEP 2: Close these junk work items
-- UNCOMMENT TO RUN:
/*
UPDATE work_items
SET
  closed_at = NOW(),
  status = 'cancelled',
  internal_notes = COALESCE(internal_notes || E'\n\n', '') ||
    'Auto-closed on ' || NOW()::DATE || ': Created from system/notification email during backfill, not a real customer inquiry'
WHERE closed_at IS NULL
  AND (
    -- Backfilled items
    reason_included->>'detected_via' = 'backfill_script'
    OR reason_included->>'detected_via' = 'auto_lead_primary_category'
  )
  AND (
    -- PayPal (all variations)
    customer_email ILIKE '%paypal%'
    OR customer_name ILIKE '%paypal%'

    -- Stripe
    OR customer_email ILIKE '%stripe%'
    OR customer_name ILIKE '%stripe%'

    -- Shopify
    OR customer_email ILIKE '%shopify%'
    OR customer_name ILIKE '%shopify%'

    -- Square
    OR customer_email ILIKE '%square%'

    -- No-reply addresses
    OR customer_email ILIKE '%noreply%'
    OR customer_email ILIKE '%no-reply%'
    OR customer_email ILIKE '%donotreply%'
    OR customer_email ILIKE '%do-not-reply%'

    -- Notification domains
    OR customer_email ILIKE '%@notifications.%'
    OR customer_email ILIKE '%@alerts.%'
    OR customer_email ILIKE '%@marketing.%'
    OR customer_email ILIKE '%@newsletter.%'

    -- Etsy
    OR customer_email ILIKE '%etsy.com%'

    -- QuickBooks
    OR customer_email ILIKE '%quickbooks%'
    OR customer_email ILIKE '%intuit%'

    -- Other business software
    OR customer_email ILIKE '%asana%'
    OR customer_email ILIKE '%trello%'
    OR customer_email ILIKE '%slack%'
    OR customer_email ILIKE '%monday.com%'
    OR customer_email ILIKE '%zoom.us%'
    OR customer_email ILIKE '%calendly%'

    -- Document services
    OR customer_email ILIKE '%adobe%'
    OR customer_email ILIKE '%docusign%'
    OR customer_email ILIKE '%dropbox%'

    -- Email marketing
    OR customer_email ILIKE '%mailchimp%'
    OR customer_email ILIKE '%constantcontact%'
    OR customer_email ILIKE '%sendgrid%'
    OR customer_email ILIKE '%hubspot%'

    -- Transactional subjects
    OR title ILIKE '%receipt%'
    OR title ILIKE '%invoice from%'
    OR title ILIKE '%payment confirmation%'
    OR title ILIKE '%order confirmation%'
    OR title ILIKE '%tracking%'
    OR title ILIKE '%you sent%payment%'
    OR title ILIKE '%you have a payment%'
  );
*/

-- STEP 3: Show summary after cleanup
SELECT
  'SUMMARY AFTER CLEANUP' as report,
  status,
  COUNT(*) as count
FROM work_items
WHERE created_at > NOW() - INTERVAL '90 days'
GROUP BY status
ORDER BY count DESC;

-- STEP 4: Show remaining open work items by email domain
SELECT
  'REMAINING OPEN WORK ITEMS BY DOMAIN' as report,
  SPLIT_PART(customer_email, '@', 2) as domain,
  COUNT(*) as count
FROM work_items
WHERE closed_at IS NULL
  AND customer_email IS NOT NULL
GROUP BY SPLIT_PART(customer_email, '@', 2)
HAVING COUNT(*) >= 2
ORDER BY count DESC
LIMIT 20;
