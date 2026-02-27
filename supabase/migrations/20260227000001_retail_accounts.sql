-- Create retail_accounts table for B2B wholesale customers
CREATE TABLE IF NOT EXISTS retail_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_name TEXT NOT NULL,
  account_type TEXT CHECK (account_type IN ('retailer', 'corporate', 'venue', 'other')) DEFAULT 'retailer',

  -- Contact Information
  primary_contact_name TEXT,
  primary_contact_email TEXT,
  primary_contact_phone TEXT,
  billing_email TEXT,

  -- Shopify Integration
  shopify_customer_id TEXT UNIQUE,

  -- Business Details
  business_address TEXT,
  city TEXT,
  state TEXT,
  zip_code TEXT,
  country TEXT DEFAULT 'US',
  website_url TEXT,
  tax_id TEXT,

  -- Account Status
  status TEXT CHECK (status IN ('active', 'inactive', 'on_hold', 'prospect')) DEFAULT 'prospect',
  credit_limit NUMERIC(10, 2),
  payment_terms TEXT, -- e.g., "Net 30", "Net 60", "Due on Receipt"

  -- Categorization
  tags TEXT[] DEFAULT ARRAY[]::TEXT[],
  industry TEXT,

  -- Relationship Management
  assigned_to_user_id UUID REFERENCES users(id),
  assigned_at TIMESTAMPTZ,

  -- Statistics (denormalized for performance)
  total_orders INTEGER DEFAULT 0,
  total_revenue NUMERIC(10, 2) DEFAULT 0,
  last_order_date TIMESTAMPTZ,
  first_order_date TIMESTAMPTZ,

  -- Notes
  internal_notes TEXT,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_by_user_id UUID REFERENCES users(id)
);

-- Create index for lookups
CREATE INDEX IF NOT EXISTS idx_retail_accounts_shopify_customer ON retail_accounts(shopify_customer_id);
CREATE INDEX IF NOT EXISTS idx_retail_accounts_status ON retail_accounts(status);
CREATE INDEX IF NOT EXISTS idx_retail_accounts_assigned_to ON retail_accounts(assigned_to_user_id);
CREATE INDEX IF NOT EXISTS idx_retail_accounts_email ON retail_accounts(primary_contact_email);

-- Create updated_at trigger
CREATE OR REPLACE FUNCTION update_retail_accounts_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER retail_accounts_updated_at_trigger
BEFORE UPDATE ON retail_accounts
FOR EACH ROW
EXECUTE FUNCTION update_retail_accounts_updated_at();

-- RLS Policies (allow authenticated users full access for now)
ALTER TABLE retail_accounts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow authenticated users to read retail accounts"
ON retail_accounts FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Allow authenticated users to insert retail accounts"
ON retail_accounts FOR INSERT
TO authenticated
WITH CHECK (true);

CREATE POLICY "Allow authenticated users to update retail accounts"
ON retail_accounts FOR UPDATE
TO authenticated
USING (true)
WITH CHECK (true);

CREATE POLICY "Allow authenticated users to delete retail accounts"
ON retail_accounts FOR DELETE
TO authenticated
USING (true);

-- Add account_id to work_items to link to retail accounts
ALTER TABLE work_items
ADD COLUMN IF NOT EXISTS retail_account_id UUID REFERENCES retail_accounts(id);

CREATE INDEX IF NOT EXISTS idx_work_items_retail_account ON work_items(retail_account_id);

COMMENT ON TABLE retail_accounts IS 'B2B wholesale customer accounts for ongoing relationships';
COMMENT ON COLUMN retail_accounts.account_type IS 'Type of account: retailer (store), corporate (company), venue (event space), other';
COMMENT ON COLUMN retail_accounts.status IS 'Account status: active (current customer), inactive (past customer), on_hold (payment issues), prospect (potential customer)';
COMMENT ON COLUMN retail_accounts.credit_limit IS 'Maximum outstanding balance allowed';
COMMENT ON COLUMN retail_accounts.payment_terms IS 'Payment terms like Net 30, Net 60, Due on Receipt';
