-- Add customer_providing_artwork column to work_items table
-- This flag indicates whether the customer will provide their own artwork

ALTER TABLE work_items
ADD COLUMN IF NOT EXISTS customer_providing_artwork BOOLEAN DEFAULT false;

-- Add index for querying items awaiting customer files
CREATE INDEX IF NOT EXISTS idx_work_items_customer_providing_artwork
ON work_items(customer_providing_artwork)
WHERE customer_providing_artwork = true;

-- Add comment explaining the column
COMMENT ON COLUMN work_items.customer_providing_artwork IS
'When true, customer will provide their own artwork. Order should be marked as awaiting_customer_files until files are received, even if deposit is paid.';
