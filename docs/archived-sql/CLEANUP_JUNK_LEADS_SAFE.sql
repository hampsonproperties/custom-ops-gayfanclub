-- ============================================================================
-- Safe Cleanup: Junk Work Items (Preserves Form Submissions)
-- Purpose: Close junk leads while keeping real customer inquiries
-- ============================================================================

-- STEP 1: Preview what will be closed (EXCLUDES form submissions)
SELECT
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
    -- Only target backfilled or auto-created items
    reason_included->>'detected_via' = 'backfill_script'
    OR reason_included->>'detected_via' = 'auto_lead_primary_category'
  )
  -- EXCLUDE form submissions (these are real leads!)
  AND customer_email NOT ILIKE '%powerfulform.com%'
  AND customer_email NOT ILIKE '%forms-noreply@google.com%'
  AND customer_email NOT ILIKE '%formstack.com%'
  AND customer_email NOT ILIKE '%typeform.com%'
  AND customer_email NOT ILIKE '%jotform.com%'
  AND customer_email NOT ILIKE '%wufoo.com%'
  -- NOW filter for junk
  AND (
    -- Payment processors
    customer_email ILIKE '%paypal%'
    OR customer_name ILIKE '%paypal%'
    OR customer_email ILIKE '%stripe%'
    OR customer_email ILIKE '%square%'

    -- E-commerce platforms
    OR customer_email ILIKE '%shopify.com%'
    OR customer_email ILIKE '%etsy.com%'
    OR customer_email ILIKE '%amazon.com%'
    OR customer_name ILIKE 'Amazon Services'

    -- Vendors (from your screenshots)
    OR customer_email ILIKE '%topdisplay.net%'
    OR customer_email ILIKE '%qing-yulan.com%'
    OR customer_email ILIKE '%uline.com%'
    OR customer_email ILIKE '%trademarkengine.com%'

    -- Security/Fraud alerts
    OR customer_email ILIKE '%@fraudalert.%'
    OR customer_email ILIKE '%@mail.instagram.com%'
    OR customer_email ILIKE 'security@%'

    -- No-reply/System addresses (NOT form providers)
    OR customer_email ILIKE '%noreply@shopify%'
    OR customer_email ILIKE '%noreply@amazon%'
    OR customer_email ILIKE '%noreply@etsy%'
    OR customer_email ILIKE '%donotreply@amazon%'
    OR customer_email ILIKE '%no-reply@stripe%'

    -- Notification domains
    OR customer_email ILIKE '%@notifications.%'
    OR customer_email ILIKE '%@alerts.%'
    OR customer_email ILIKE '%@marketing.%'
    OR customer_email ILIKE '%@newsletter.%'

    -- Business software
    OR customer_email ILIKE '%quickbooks%'
    OR customer_email ILIKE '%intuit%'
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

    -- Spam patterns
    OR customer_name ILIKE '%SHOPIFY PRO%'

    -- Transactional subjects
    OR title ILIKE '%payment confirmation%'
    OR title ILIKE '%order confirmation%'
    OR title ILIKE '%you sent%payment%'
    OR title ILIKE '%you have a payment%'
    OR title ILIKE '%funds%on the way%'
    OR title ILIKE '%trademark monitoring%'
    OR title ILIKE 'Walmart.com:%'
  )
ORDER BY created_at DESC;

-- STEP 2: Close the junk work items
-- UNCOMMENT TO RUN:
/*
UPDATE work_items
SET
  closed_at = NOW(),
  status = 'cancelled',
  internal_notes = COALESCE(internal_notes || E'\n\n', '') ||
    'Auto-closed on ' || NOW()::DATE || ': System/vendor email, not a customer inquiry'
WHERE closed_at IS NULL
  AND (
    reason_included->>'detected_via' = 'backfill_script'
    OR reason_included->>'detected_via' = 'auto_lead_primary_category'
  )
  -- EXCLUDE form submissions
  AND customer_email NOT ILIKE '%powerfulform.com%'
  AND customer_email NOT ILIKE '%forms-noreply@google.com%'
  AND customer_email NOT ILIKE '%formstack.com%'
  AND customer_email NOT ILIKE '%typeform.com%'
  AND customer_email NOT ILIKE '%jotform.com%'
  AND customer_email NOT ILIKE '%wufoo.com%'
  -- Filter for junk
  AND (
    -- Payment processors
    customer_email ILIKE '%paypal%'
    OR customer_name ILIKE '%paypal%'
    OR customer_email ILIKE '%stripe%'
    OR customer_email ILIKE '%square%'

    -- E-commerce platforms
    OR customer_email ILIKE '%shopify.com%'
    OR customer_email ILIKE '%etsy.com%'
    OR customer_email ILIKE '%amazon.com%'
    OR customer_name ILIKE 'Amazon Services'

    -- Vendors
    OR customer_email ILIKE '%topdisplay.net%'
    OR customer_email ILIKE '%qing-yulan.com%'
    OR customer_email ILIKE '%uline.com%'
    OR customer_email ILIKE '%trademarkengine.com%'

    -- Security/Fraud alerts
    OR customer_email ILIKE '%@fraudalert.%'
    OR customer_email ILIKE '%@mail.instagram.com%'
    OR customer_email ILIKE 'security@%'

    -- No-reply/System addresses (NOT form providers)
    OR customer_email ILIKE '%noreply@shopify%'
    OR customer_email ILIKE '%noreply@amazon%'
    OR customer_email ILIKE '%noreply@etsy%'
    OR customer_email ILIKE '%donotreply@amazon%'
    OR customer_email ILIKE '%no-reply@stripe%'

    -- Notification domains
    OR customer_email ILIKE '%@notifications.%'
    OR customer_email ILIKE '%@alerts.%'
    OR customer_email ILIKE '%@marketing.%'
    OR customer_email ILIKE '%@newsletter.%'

    -- Business software
    OR customer_email ILIKE '%quickbooks%'
    OR customer_email ILIKE '%intuit%'
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

    -- Spam patterns
    OR customer_name ILIKE '%SHOPIFY PRO%'

    -- Transactional subjects
    OR title ILIKE '%payment confirmation%'
    OR title ILIKE '%order confirmation%'
    OR title ILIKE '%you sent%payment%'
    OR title ILIKE '%you have a payment%'
    OR title ILIKE '%funds%on the way%'
    OR title ILIKE '%trademark monitoring%'
    OR title ILIKE 'Walmart.com:%'
  );
*/

-- STEP 3: Verify form submissions were NOT affected
SELECT
  'FORM SUBMISSIONS (should be UNTOUCHED)' as check_type,
  id,
  customer_email,
  title,
  status,
  closed_at
FROM work_items
WHERE customer_email ILIKE '%powerfulform.com%'
   OR customer_email ILIKE '%forms-noreply@google.com%'
ORDER BY created_at DESC
LIMIT 10;
