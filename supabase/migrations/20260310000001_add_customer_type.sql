-- Add customer_type to customers table for distinguishing individuals, retailers, and organizations
ALTER TABLE customers
ADD COLUMN IF NOT EXISTS customer_type TEXT
  CHECK (customer_type IN ('individual', 'retailer', 'organization'))
  DEFAULT 'individual'
  NOT NULL;

-- Add optional link to retail_accounts for retailers with B2B details
ALTER TABLE customers
ADD COLUMN IF NOT EXISTS retail_account_id UUID
  REFERENCES retail_accounts(id) ON DELETE SET NULL;

-- Indexes for filtering
CREATE INDEX IF NOT EXISTS idx_customers_customer_type ON customers(customer_type);
CREATE INDEX IF NOT EXISTS idx_customers_retail_account_id ON customers(retail_account_id);

COMMENT ON COLUMN customers.customer_type IS 'Type of customer: individual (default), retailer (B2B wholesale), organization (non-profit, group, etc.)';
COMMENT ON COLUMN customers.retail_account_id IS 'Optional link to retail_accounts table for retailers with B2B details (credit terms, etc.)';
