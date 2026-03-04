-- Create shopify_orders table to store order history from Shopify
-- This enables revenue tracking and order history on customer pages

CREATE TABLE IF NOT EXISTS shopify_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shopify_order_id TEXT UNIQUE NOT NULL,
  shopify_order_number TEXT NOT NULL,
  customer_id UUID REFERENCES customers(id) ON DELETE SET NULL,
  customer_email TEXT NOT NULL,
  total_price NUMERIC(10,2) NOT NULL,
  subtotal_price NUMERIC(10,2),
  total_tax NUMERIC(10,2),
  currency TEXT DEFAULT 'USD',
  financial_status TEXT, -- paid, pending, refunded, etc.
  fulfillment_status TEXT, -- fulfilled, partial, null
  line_items JSONB, -- Store line items as JSON
  created_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  order_data JSONB -- Full Shopify order object for reference
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_shopify_orders_customer_id
  ON shopify_orders(customer_id)
  WHERE customer_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_shopify_orders_customer_email
  ON shopify_orders(customer_email);

CREATE INDEX IF NOT EXISTS idx_shopify_orders_created_at
  ON shopify_orders(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_shopify_orders_shopify_id
  ON shopify_orders(shopify_order_id);

-- RLS Policies for security
ALTER TABLE shopify_orders ENABLE ROW LEVEL SECURITY;

-- Authenticated users can view all Shopify orders
CREATE POLICY "Users can view all shopify orders"
  ON shopify_orders FOR SELECT
  TO authenticated
  USING (true);

-- Only service role can insert/update Shopify orders
-- This ensures only the sync API can modify order data
CREATE POLICY "Only service role can insert/update shopify orders"
  ON shopify_orders FOR ALL
  TO service_role
  USING (true);

-- Grant permissions
GRANT SELECT ON shopify_orders TO authenticated;
GRANT ALL ON shopify_orders TO service_role;
