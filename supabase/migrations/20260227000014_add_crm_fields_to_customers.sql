-- Add CRM fields to customers table for sales management
-- =================================================================
-- Per PDR v4, customers page is PRIMARY workspace and needs these fields

-- Add CRM fields
ALTER TABLE customers
ADD COLUMN IF NOT EXISTS assigned_to_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS organization_name TEXT,
ADD COLUMN IF NOT EXISTS estimated_value NUMERIC(10,2),
ADD COLUMN IF NOT EXISTS next_follow_up_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS sales_stage TEXT DEFAULT 'new_lead',
ADD COLUMN IF NOT EXISTS shopify_customer_id TEXT,
ADD COLUMN IF NOT EXISTS shopify_last_sync_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS total_order_count INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS total_spent NUMERIC(10,2) DEFAULT 0;

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_customers_assigned_to
ON customers(assigned_to_user_id)
WHERE assigned_to_user_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_customers_sales_stage
ON customers(sales_stage);

CREATE INDEX IF NOT EXISTS idx_customers_next_follow_up
ON customers(next_follow_up_at)
WHERE next_follow_up_at IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_customers_shopify_id
ON customers(shopify_customer_id)
WHERE shopify_customer_id IS NOT NULL;

-- Create unique constraint on shopify_customer_id (if not null)
CREATE UNIQUE INDEX IF NOT EXISTS idx_customers_shopify_id_unique
ON customers(shopify_customer_id)
WHERE shopify_customer_id IS NOT NULL;

-- Add helpful comments
COMMENT ON COLUMN customers.assigned_to_user_id IS 'Team member responsible for this customer relationship';
COMMENT ON COLUMN customers.organization_name IS 'Company or organization name';
COMMENT ON COLUMN customers.estimated_value IS 'Estimated total potential value of this customer';
COMMENT ON COLUMN customers.next_follow_up_at IS 'When to follow up with this customer next';
COMMENT ON COLUMN customers.sales_stage IS 'Sales pipeline stage: new_lead, contacted, in_discussion, quoted, negotiating, won, active_customer, lost';
COMMENT ON COLUMN customers.shopify_customer_id IS 'Shopify customer ID for integration';
COMMENT ON COLUMN customers.total_order_count IS 'Total number of Shopify orders';
COMMENT ON COLUMN customers.total_spent IS 'Total amount spent (from Shopify)';

-- Update existing customers to have a default sales stage
UPDATE customers
SET sales_stage = 'active_customer'
WHERE sales_stage IS NULL;

-- Make sales_stage NOT NULL after setting defaults
ALTER TABLE customers
ALTER COLUMN sales_stage SET NOT NULL;
