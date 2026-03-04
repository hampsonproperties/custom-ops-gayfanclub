-- STEP 1: Preview junk work items that will be closed
-- (Does NOT include PowerfulForm - those are real leads!)

SELECT
  id,
  customer_name,
  customer_email,
  title,
  status,
  created_at,
  reason_included->>'detected_via' as how_created
FROM work_items
WHERE closed_at IS NULL
  AND status IN ('new_inquiry', 'quote_sent', 'design_fee_sent', 'invoice_sent', 'awaiting_payment')
  AND reason_included->>'detected_via' = 'backfill_script' -- Only backfill items
  AND customer_email NOT ILIKE '%powerfulform%' -- KEEP PowerfulForm (real leads!)
  AND (
    -- Payment processors
    customer_email ILIKE '%paypal%' OR
    customer_email ILIKE '%stripe%' OR
    customer_email ILIKE '%square%' OR
    customer_email ILIKE '%apple%' OR
    customer_email ILIKE '%venmo%' OR

    -- E-commerce platforms
    customer_email ILIKE '%shopify%' OR
    customer_email ILIKE '%etsy%' OR
    customer_email ILIKE '%amazon%' OR
    customer_email ILIKE '%ebay%' OR
    customer_email ILIKE '%faire%' OR

    -- No-reply patterns (but NOT powerfulform)
    (customer_email ILIKE '%noreply%' AND customer_email NOT ILIKE '%powerfulform%') OR
    (customer_email ILIKE '%no-reply%' AND customer_email NOT ILIKE '%powerfulform%') OR
    customer_email ILIKE '%donotreply%' OR
    customer_email ILIKE '%do-not-reply%' OR

    -- Notification subdomains
    customer_email ILIKE '%@notifications.%' OR
    customer_email ILIKE '%@alerts.%' OR
    customer_email ILIKE '%@info.%' OR
    customer_email ILIKE '%@marketing.%' OR
    customer_email ILIKE '%automated%' OR

    -- Business software
    customer_email ILIKE '%quickbooks%' OR
    customer_email ILIKE '%xero%' OR
    customer_email ILIKE '%asana%' OR
    customer_email ILIKE '%trello%' OR
    customer_email ILIKE '%slack%' OR
    customer_email ILIKE '%zoom%' OR
    customer_email ILIKE '%calendly%' OR

    -- Document/Adobe
    customer_email ILIKE '%adobe%' OR
    customer_email ILIKE '%docusign%' OR
    customer_email ILIKE '%dropbox%' OR

    -- Dev tools
    customer_email ILIKE '%github%' OR
    customer_email ILIKE '%vercel%' OR
    customer_email ILIKE '%supabase%' OR
    customer_email ILIKE '%heroku%'
  )
ORDER BY created_at DESC;


-- STEP 2: After reviewing, uncomment this to close the junk leads
/*
UPDATE work_items
SET
  closed_at = NOW(),
  status = 'cancelled'
WHERE closed_at IS NULL
  AND status IN ('new_inquiry', 'quote_sent', 'design_fee_sent', 'invoice_sent', 'awaiting_payment')
  AND reason_included->>'detected_via' = 'backfill_script'
  AND customer_email NOT ILIKE '%powerfulform%' -- KEEP PowerfulForm!
  AND (
    customer_email ILIKE '%paypal%' OR
    customer_email ILIKE '%stripe%' OR
    customer_email ILIKE '%square%' OR
    customer_email ILIKE '%apple%' OR
    customer_email ILIKE '%venmo%' OR
    customer_email ILIKE '%shopify%' OR
    customer_email ILIKE '%etsy%' OR
    customer_email ILIKE '%amazon%' OR
    customer_email ILIKE '%ebay%' OR
    customer_email ILIKE '%faire%' OR
    (customer_email ILIKE '%noreply%' AND customer_email NOT ILIKE '%powerfulform%') OR
    (customer_email ILIKE '%no-reply%' AND customer_email NOT ILIKE '%powerfulform%') OR
    customer_email ILIKE '%donotreply%' OR
    customer_email ILIKE '%do-not-reply%' OR
    customer_email ILIKE '%@notifications.%' OR
    customer_email ILIKE '%@alerts.%' OR
    customer_email ILIKE '%@info.%' OR
    customer_email ILIKE '%@marketing.%' OR
    customer_email ILIKE '%automated%' OR
    customer_email ILIKE '%quickbooks%' OR
    customer_email ILIKE '%xero%' OR
    customer_email ILIKE '%asana%' OR
    customer_email ILIKE '%trello%' OR
    customer_email ILIKE '%slack%' OR
    customer_email ILIKE '%zoom%' OR
    customer_email ILIKE '%calendly%' OR
    customer_email ILIKE '%adobe%' OR
    customer_email ILIKE '%docusign%' OR
    customer_email ILIKE '%dropbox%' OR
    customer_email ILIKE '%github%' OR
    customer_email ILIKE '%vercel%' OR
    customer_email ILIKE '%supabase%' OR
    customer_email ILIKE '%heroku%'
  );
*/
