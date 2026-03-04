-- Add columns to track design fee order separately from production order
ALTER TABLE work_items
ADD COLUMN IF NOT EXISTS design_fee_order_id TEXT,
ADD COLUMN IF NOT EXISTS design_fee_order_number TEXT;

-- Add comment for documentation
COMMENT ON COLUMN work_items.design_fee_order_id IS 'Shopify order ID for the design fee payment (e.g., #6521)';
COMMENT ON COLUMN work_items.design_fee_order_number IS 'Shopify order number for the design fee payment (e.g., #6521)';
COMMENT ON COLUMN work_items.shopify_order_id IS 'Shopify order ID for the production/main order (e.g., #6541)';
COMMENT ON COLUMN work_items.shopify_order_number IS 'Shopify order number for the production/main order (e.g., #6541)';
