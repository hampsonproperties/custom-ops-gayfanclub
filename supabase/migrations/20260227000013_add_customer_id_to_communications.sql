-- Add customer_id to communications table
-- =================================================================
-- This allows filtering communications by customer directly,
-- useful for customer-level activity feeds

-- Add customer_id column
ALTER TABLE communications
ADD COLUMN IF NOT EXISTS customer_id UUID REFERENCES customers(id) ON DELETE SET NULL;

-- Create index for customer communications
CREATE INDEX IF NOT EXISTS idx_communications_customer
ON communications(customer_id)
WHERE customer_id IS NOT NULL;

-- Add helpful comment
COMMENT ON COLUMN communications.customer_id IS 'Link communication to customer (for customer-level activity feed)';

-- Backfill customer_id from work_items where possible
UPDATE communications c
SET customer_id = wi.customer_id
FROM work_items wi
WHERE c.work_item_id = wi.id
  AND c.customer_id IS NULL;
