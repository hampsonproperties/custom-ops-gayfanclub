-- Add alternate_emails column to work_items table
-- This allows tracking multiple email addresses for the same customer

ALTER TABLE work_items
ADD COLUMN IF NOT EXISTS alternate_emails TEXT[] DEFAULT '{}';

-- Add index for faster lookups when searching by alternate emails
CREATE INDEX IF NOT EXISTS idx_work_items_alternate_emails ON work_items USING GIN (alternate_emails);

-- Add comment explaining the column
COMMENT ON COLUMN work_items.alternate_emails IS 'Additional email addresses associated with this customer (e.g., personal vs work email). Used for auto-linking emails from the same customer.';
