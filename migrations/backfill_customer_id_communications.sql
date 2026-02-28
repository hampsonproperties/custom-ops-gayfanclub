-- Backfill customer_id for existing communications
-- This links emails to customers via their work_items
-- Run this after fixing the email import code

-- Update communications that have a work_item but no customer_id
UPDATE communications c
SET customer_id = wi.customer_id
FROM work_items wi
WHERE c.work_item_id = wi.id
  AND c.customer_id IS NULL
  AND wi.customer_id IS NOT NULL;

-- Report results
SELECT
  'Backfill complete' as status,
  COUNT(*) as total_communications,
  COUNT(customer_id) as with_customer_id,
  COUNT(*) - COUNT(customer_id) as missing_customer_id
FROM communications;
