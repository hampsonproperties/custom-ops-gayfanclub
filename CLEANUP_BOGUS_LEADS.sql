-- ============================================================================
-- Cleanup Bogus Leads Created by Backfill Script
-- Purpose: Delete work items from system/spam emails, re-categorize emails
-- ============================================================================

-- STEP 1: Preview what will be deleted
-- ============================================================================
SELECT
  'PREVIEW - Will Delete These Leads' as action,
  wi.id,
  wi.customer_name,
  wi.customer_email,
  wi.title,
  wi.created_at,
  wi.reason_included
FROM work_items wi
WHERE wi.reason_included->>'detected_via' = 'backfill_script'
  AND (
    -- Payment processors
    wi.customer_email LIKE '%@paypal.com'
    OR wi.customer_email LIKE '%@stripe.com'
    OR wi.customer_email LIKE '%@square.com'

    -- Notifications
    OR wi.customer_email LIKE '%@ringcentral.com'
    OR wi.customer_email LIKE '%@adobe.com'
    OR wi.customer_email LIKE '%@acrobat.com'
    OR wi.customer_email LIKE '%@dropbox.com'
    OR wi.customer_email LIKE '%@docusign.com'

    -- Generic spam patterns (be careful - check before deleting)
    OR wi.customer_email LIKE '%notifications.%'
    OR wi.customer_email LIKE '%noreply@%'
    OR wi.customer_email LIKE '%do-not-reply@%'
    OR wi.customer_email LIKE '%@marketing.%'
    OR wi.customer_email LIKE '%@newsletter.%'

    -- Shopify
    OR wi.customer_email LIKE '%@shopify.com'
    OR wi.customer_email LIKE '%@orders.shopify.com'

    -- Business software
    OR wi.customer_email LIKE '%@quickbooks.com'
    OR wi.customer_email LIKE '%@xero.com'
    OR wi.customer_email LIKE '%@asana.com'
    OR wi.customer_email LIKE '%@trello.com'
    OR wi.customer_email LIKE '%@slack.com'

    -- Dev tools
    OR wi.customer_email LIKE '%@github.com'
    OR wi.customer_email LIKE '%@vercel.com'
    OR wi.customer_email LIKE '%@supabase.com'
  );

-- STEP 2: Count how many will be deleted
-- ============================================================================
DO $$
DECLARE
  delete_count INTEGER;
  total_backfilled INTEGER;
BEGIN
  SELECT COUNT(*) INTO total_backfilled
  FROM work_items
  WHERE reason_included->>'detected_via' = 'backfill_script';

  SELECT COUNT(*) INTO delete_count
  FROM work_items wi
  WHERE wi.reason_included->>'detected_via' = 'backfill_script'
    AND (
      wi.customer_email LIKE '%@paypal.com'
      OR wi.customer_email LIKE '%@stripe.com'
      OR wi.customer_email LIKE '%@square.com'
      OR wi.customer_email LIKE '%@ringcentral.com'
      OR wi.customer_email LIKE '%@adobe.com'
      OR wi.customer_email LIKE '%@acrobat.com'
      OR wi.customer_email LIKE '%@dropbox.com'
      OR wi.customer_email LIKE '%@docusign.com'
      OR wi.customer_email LIKE '%'
      OR wi.customer_email LIKE '%notifications.%'
      OR wi.customer_email LIKE '%noreply@%'
      OR wi.customer_email LIKE '%do-not-reply@%'
      OR wi.customer_email LIKE '%@marketing.%'
      OR wi.customer_email LIKE '%@newsletter.%'
      OR wi.customer_email LIKE '%@shopify.com'
      OR wi.customer_email LIKE '%@orders.shopify.com'
      OR wi.customer_email LIKE '%@quickbooks.com'
      OR wi.customer_email LIKE '%@xero.com'
      OR wi.customer_email LIKE '%@asana.com'
      OR wi.customer_email LIKE '%@trello.com'
      OR wi.customer_email LIKE '%@slack.com'
      OR wi.customer_email LIKE '%@github.com'
      OR wi.customer_email LIKE '%@vercel.com'
      OR wi.customer_email LIKE '%@supabase.com'
    );

  RAISE NOTICE '';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'Bogus Leads Cleanup Preview';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'Total leads created by backfill: %', total_backfilled;
  RAISE NOTICE 'Bogus leads to delete: %', delete_count;
  RAISE NOTICE 'Real leads to keep: %', total_backfilled - delete_count;
  RAISE NOTICE '';
  RAISE NOTICE 'Review the preview above. If it looks correct, uncomment STEP 3 below.';
  RAISE NOTICE '========================================';
END $$;

-- STEP 3: DELETE BOGUS LEADS (UNCOMMENT TO RUN)
-- ============================================================================
-- UNCOMMENT THE LINES BELOW TO ACTUALLY DELETE

/*
DELETE FROM work_items
WHERE reason_included->>'detected_via' = 'backfill_script'
  AND (
    customer_email LIKE '%@paypal.com'
    OR customer_email LIKE '%@stripe.com'
    OR customer_email LIKE '%@square.com'
    OR customer_email LIKE '%@ringcentral.com'
    OR customer_email LIKE '%@adobe.com'
    OR customer_email LIKE '%@acrobat.com'
    OR customer_email LIKE '%@dropbox.com'
    OR customer_email LIKE '%@docusign.com'
    OR customer_email LIKE '%'
    OR customer_email LIKE '%notifications.%'
    OR customer_email LIKE '%noreply@%'
    OR customer_email LIKE '%do-not-reply@%'
    OR customer_email LIKE '%@marketing.%'
    OR customer_email LIKE '%@newsletter.%'
    OR customer_email LIKE '%@shopify.com'
    OR customer_email LIKE '%@orders.shopify.com'
    OR customer_email LIKE '%@quickbooks.com'
    OR customer_email LIKE '%@xero.com'
    OR customer_email LIKE '%@asana.com'
    OR customer_email LIKE '%@trello.com'
    OR customer_email LIKE '%@slack.com'
    OR customer_email LIKE '%@github.com'
    OR customer_email LIKE '%@vercel.com'
    OR customer_email LIKE '%@supabase.com'
  );
*/

-- STEP 4: Re-apply email filters to ALL existing emails
-- ============================================================================
-- This will properly categorize emails that should be notifications/promotional

-- Update emails that match filter patterns
UPDATE communications c
SET category = (
  SELECT ef.target_category
  FROM email_filters ef
  WHERE ef.is_active = true
    AND (
      (ef.filter_type = 'domain' AND c.from_email ILIKE '%' || ef.pattern || '%')
      OR (ef.filter_type = 'sender' AND c.from_email ILIKE ef.pattern)
      OR (ef.filter_type = 'subject' AND c.subject ILIKE '%' || ef.pattern || '%')
    )
  ORDER BY ef.priority DESC
  LIMIT 1
)
WHERE category = 'primary'
  AND EXISTS (
    SELECT 1
    FROM email_filters ef
    WHERE ef.is_active = true
      AND (
        (ef.filter_type = 'domain' AND c.from_email ILIKE '%' || ef.pattern || '%')
        OR (ef.filter_type = 'sender' AND c.from_email ILIKE ef.pattern)
        OR (ef.filter_type = 'subject' AND c.subject ILIKE '%' || ef.pattern || '%')
      )
  );

-- Summary
DO $$
DECLARE
  primary_count INTEGER;
  notifications_count INTEGER;
  promotional_count INTEGER;
  spam_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO primary_count FROM communications WHERE category = 'primary';
  SELECT COUNT(*) INTO notifications_count FROM communications WHERE category = 'notifications';
  SELECT COUNT(*) INTO promotional_count FROM communications WHERE category = 'promotional';
  SELECT COUNT(*) INTO spam_count FROM communications WHERE category = 'spam';

  RAISE NOTICE '';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'Email Re-Categorization Complete';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'Primary: %', primary_count;
  RAISE NOTICE 'Notifications: %', notifications_count;
  RAISE NOTICE 'Promotional: %', promotional_count;
  RAISE NOTICE 'Spam: %', spam_count;
  RAISE NOTICE '';
  RAISE NOTICE 'Now only TRUE customer emails should be in primary!';
  RAISE NOTICE '========================================';
END $$;
