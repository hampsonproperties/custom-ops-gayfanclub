UPDATE work_items
SET
  closed_at = NOW(),
  status = 'cancelled'
WHERE
  closed_at IS NULL
  AND status IN ('new_inquiry', 'quote_sent', 'design_fee_sent', 'invoice_sent', 'awaiting_payment')
  AND reason_included->>'detected_via' = 'backfill_script'
  AND customer_email NOT ILIKE '%powerfulform%'
  AND (
    customer_email ILIKE '%paypal%' OR
    customer_email ILIKE '%stripe%' OR
    customer_email ILIKE '%square%' OR
    customer_email ILIKE '%apple%' OR
    customer_email ILIKE '%faire%' OR
    customer_email ILIKE '%amazon%'
  );
