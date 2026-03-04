-- Review all remaining leads to check if they're legitimate or junk

SELECT
  id,
  customer_name,
  customer_email,
  title,
  status,
  created_at,
  reason_included->>'detected_via' as how_created,
  CASE
    -- Flag potential junk patterns
    WHEN customer_email ILIKE '%@gmail.com%' OR customer_email ILIKE '%@yahoo.com%' OR customer_email ILIKE '%@hotmail.com%' THEN 'likely_real'
    WHEN customer_email ILIKE '%powerfulform%' THEN 'real_lead_form'
    WHEN customer_email ILIKE '%support%' OR customer_email ILIKE '%help%' OR customer_email ILIKE '%service%' THEN 'likely_junk'
    WHEN customer_email ILIKE '%info@%' OR customer_email ILIKE '%@info.%' THEN 'likely_junk'
    WHEN customer_email ILIKE '%marketing%' OR customer_email ILIKE '%sales@%' THEN 'likely_junk'
    WHEN customer_email ILIKE '%.org%' THEN 'likely_real'
    ELSE 'unknown'
  END as classification
FROM work_items
WHERE closed_at IS NULL
  AND status IN ('new_inquiry', 'quote_sent', 'design_fee_sent', 'invoice_sent', 'awaiting_payment')
ORDER BY
  CASE
    WHEN customer_email ILIKE '%powerfulform%' THEN 1
    WHEN customer_email ILIKE '%@gmail.com%' OR customer_email ILIKE '%@yahoo.com%' OR customer_email ILIKE '%@hotmail.com%' THEN 2
    WHEN customer_email ILIKE '%.org%' THEN 3
    ELSE 4
  END,
  created_at DESC;
