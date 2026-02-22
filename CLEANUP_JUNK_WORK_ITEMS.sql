-- ============================================================================
-- Cleanup Junk Work Items
-- Purpose: Close work items that were created from notification emails
-- ============================================================================

-- STEP 1: Preview what will be closed
SELECT
  'PREVIEW - WILL BE CLOSED' as action,
  id,
  customer_name,
  customer_email,
  title,
  status,
  source,
  created_at
FROM work_items
WHERE closed_at IS NULL
  AND (
    -- PayPal notifications
    customer_email ILIKE '%@paypal.com%'
    OR customer_email ILIKE '%service@paypal%'

    -- No-reply system emails
    OR customer_email ILIKE '%noreply%'
    OR customer_email ILIKE '%no-reply%'

    -- Shopify notifications
    OR customer_email ILIKE '%@shopify.com%'
    OR customer_email ILIKE '%mailer@shopify%'

    -- Stripe notifications
    OR customer_email ILIKE '%@stripe.com%'

    -- Generic notification domains
    OR customer_email ILIKE '%@notifications.%'
    OR customer_email ILIKE '%@alerts.%'

    -- Transactional subjects that shouldn't be work items
    OR title ILIKE '%order confirmation%'
    OR title ILIKE '%receipt from%'
    OR title ILIKE '%invoice from%'
    OR title ILIKE '%payment received%'
    OR title ILIKE '%tracking%'
  );

-- STEP 2: Close these work items (run this after reviewing preview)
-- UNCOMMENT TO RUN:
/*
UPDATE work_items
SET
  closed_at = NOW(),
  status = 'cancelled',
  internal_notes = COALESCE(internal_notes || E'\n\n', '') ||
    'Auto-closed: Created from notification/system email, not a real customer inquiry'
WHERE closed_at IS NULL
  AND (
    -- PayPal notifications
    customer_email ILIKE '%@paypal.com%'
    OR customer_email ILIKE '%service@paypal%'

    -- No-reply system emails
    OR customer_email ILIKE '%noreply%'
    OR customer_email ILIKE '%no-reply%'

    -- Shopify notifications
    OR customer_email ILIKE '%@shopify.com%'
    OR customer_email ILIKE '%mailer@shopify%'

    -- Stripe notifications
    OR customer_email ILIKE '%@stripe.com%'

    -- Generic notification domains
    OR customer_email ILIKE '%@notifications.%'
    OR customer_email ILIKE '%@alerts.%'

    -- Transactional subjects that shouldn't be work items
    OR title ILIKE '%order confirmation%'
    OR title ILIKE '%receipt from%'
    OR title ILIKE '%invoice from%'
    OR title ILIKE '%payment received%'
    OR title ILIKE '%tracking%'
  );
*/

-- STEP 3: Verify cleanup
SELECT
  'AFTER CLEANUP' as status,
  status,
  COUNT(*) as count
FROM work_items
WHERE created_at > NOW() - INTERVAL '90 days'
GROUP BY status
ORDER BY count DESC;
