-- Table to store Shopify OAuth credentials
CREATE TABLE IF NOT EXISTS shopify_credentials (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shop TEXT NOT NULL UNIQUE,
  access_token TEXT NOT NULL,
  scope TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- RLS policies
ALTER TABLE shopify_credentials ENABLE ROW LEVEL SECURITY;

-- Service role can do everything
CREATE POLICY "Service role has full access to shopify_credentials"
  ON shopify_credentials
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Create updated_at trigger
CREATE TRIGGER set_shopify_credentials_updated_at
  BEFORE UPDATE ON shopify_credentials
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
