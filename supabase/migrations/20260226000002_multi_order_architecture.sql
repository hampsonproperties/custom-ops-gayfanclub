-- ============================================================================
-- Phase 2: Multi-Order Architecture
-- Migration: 20260226000002_multi_order_architecture.sql
--
-- Creates customer_orders table to track unlimited orders per customer
-- Separates order tracking from production work items
-- Enables customer-level analytics and order history
-- ============================================================================

-- ============================================================================
-- 1. CUSTOMER_ORDERS TABLE
-- Tracks all Shopify orders for a customer, separate from production work items
-- ============================================================================

CREATE TABLE IF NOT EXISTS customer_orders (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

  -- Links
  customer_id UUID REFERENCES customers(id) ON DELETE SET NULL,
  work_item_id UUID REFERENCES work_items(id) ON DELETE SET NULL,

  -- Shopify identifiers
  shopify_order_id TEXT NOT NULL UNIQUE,
  shopify_order_number TEXT NOT NULL,
  shopify_customer_id TEXT,

  -- Order classification
  order_type TEXT NOT NULL CHECK (order_type IN ('customify_order', 'custom_design_service', 'custom_bulk_order')),

  -- Financial details
  total_price DECIMAL(10, 2),
  currency TEXT DEFAULT 'USD',
  financial_status TEXT, -- paid, partially_paid, refunded, voided
  fulfillment_status TEXT, -- shipped, partial, unshipped, delivered

  -- Payment details (detailed tracking)
  payment_history JSONB DEFAULT '[]'::jsonb,

  -- Order metadata
  tags TEXT[], -- Shopify order tags
  note TEXT, -- Order notes from Shopify
  line_items JSONB, -- Store line items for reference

  -- Timestamps
  shopify_created_at TIMESTAMPTZ,
  shopify_updated_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for customer_orders
CREATE INDEX IF NOT EXISTS idx_customer_orders_customer ON customer_orders(customer_id);
CREATE INDEX IF NOT EXISTS idx_customer_orders_work_item ON customer_orders(work_item_id);
CREATE INDEX IF NOT EXISTS idx_customer_orders_shopify_customer ON customer_orders(shopify_customer_id);
CREATE INDEX IF NOT EXISTS idx_customer_orders_type ON customer_orders(order_type);
CREATE INDEX IF NOT EXISTS idx_customer_orders_financial ON customer_orders(financial_status);
CREATE INDEX IF NOT EXISTS idx_customer_orders_created ON customer_orders(shopify_created_at DESC);
CREATE INDEX IF NOT EXISTS idx_customer_orders_tags ON customer_orders USING GIN (tags);

-- Comments for customer_orders
COMMENT ON TABLE customer_orders IS 'All Shopify orders, linked to customers and optionally to work items';
COMMENT ON COLUMN customer_orders.work_item_id IS 'Optional link to production work item (may be null for non-production orders)';
COMMENT ON COLUMN customer_orders.line_items IS 'Shopify line items JSON for reference';

-- ============================================================================
-- 2. ENHANCE CUSTOMERS TABLE
-- Add aggregates and metadata for customer master record
-- ============================================================================

ALTER TABLE customers
ADD COLUMN IF NOT EXISTS tags TEXT[] DEFAULT '{}',
ADD COLUMN IF NOT EXISTS total_orders INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS total_spent DECIMAL(10, 2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS last_order_date TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS first_order_date TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}'::jsonb;

CREATE INDEX IF NOT EXISTS idx_customers_shopify_id ON customers(shopify_customer_id);
CREATE INDEX IF NOT EXISTS idx_customers_tags ON customers USING GIN (tags);
CREATE INDEX IF NOT EXISTS idx_customers_total_spent ON customers(total_spent DESC NULLS LAST);

COMMENT ON COLUMN customers.tags IS 'Customer tags from Shopify';
COMMENT ON COLUMN customers.total_orders IS 'Total number of orders placed';
COMMENT ON COLUMN customers.total_spent IS 'Total amount spent across all orders';
COMMENT ON COLUMN customers.metadata IS 'Additional customer metadata from Shopify';

-- ============================================================================
-- 3. HELPER FUNCTION: Update Customer Aggregates
-- ============================================================================

CREATE OR REPLACE FUNCTION update_customer_aggregates(p_customer_id UUID)
RETURNS void AS $$
BEGIN
  UPDATE customers
  SET
    total_orders = (SELECT COUNT(*) FROM customer_orders WHERE customer_id = p_customer_id),
    total_spent = (SELECT COALESCE(SUM(total_price), 0) FROM customer_orders WHERE customer_id = p_customer_id),
    last_order_date = (SELECT MAX(shopify_created_at) FROM customer_orders WHERE customer_id = p_customer_id),
    first_order_date = (SELECT MIN(shopify_created_at) FROM customer_orders WHERE customer_id = p_customer_id),
    updated_at = NOW()
  WHERE id = p_customer_id;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION update_customer_aggregates IS 'Recalculates customer total_orders, total_spent, and order dates';

-- ============================================================================
-- 4. TRIGGER: Auto-update customer aggregates on order changes
-- ============================================================================

CREATE OR REPLACE FUNCTION trigger_update_customer_aggregates()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF OLD.customer_id IS NOT NULL THEN
      PERFORM update_customer_aggregates(OLD.customer_id);
    END IF;
    RETURN OLD;
  ELSE
    IF NEW.customer_id IS NOT NULL THEN
      PERFORM update_customer_aggregates(NEW.customer_id);
    END IF;
    RETURN NEW;
  END IF;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_customer_aggregates_on_order ON customer_orders;

CREATE TRIGGER update_customer_aggregates_on_order
AFTER INSERT OR UPDATE OR DELETE ON customer_orders
FOR EACH ROW
EXECUTE FUNCTION trigger_update_customer_aggregates();

-- ============================================================================
-- 5. DATA MIGRATION: Populate customer_orders from existing work_items
-- ============================================================================

-- Migrate production orders (shopify_order_id)
INSERT INTO customer_orders (
  customer_id,
  work_item_id,
  shopify_order_id,
  shopify_order_number,
  order_type,
  total_price,
  financial_status,
  fulfillment_status,
  payment_history,
  shopify_created_at,
  shopify_updated_at
)
SELECT
  wi.customer_id,
  wi.id,
  wi.shopify_order_id,
  wi.shopify_order_number,
  wi.type,
  wi.actual_value,
  wi.shopify_financial_status,
  wi.shopify_fulfillment_status,
  wi.payment_history,
  wi.created_at,
  wi.updated_at
FROM work_items wi
WHERE wi.shopify_order_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM customer_orders co
    WHERE co.shopify_order_id = wi.shopify_order_id
  );

-- Migrate design fee orders (design_fee_order_id)
INSERT INTO customer_orders (
  customer_id,
  work_item_id,
  shopify_order_id,
  shopify_order_number,
  order_type,
  financial_status,
  shopify_created_at,
  shopify_updated_at
)
SELECT
  wi.customer_id,
  wi.id,
  wi.design_fee_order_id,
  wi.design_fee_order_number,
  'custom_design_service',
  CASE
    WHEN wi.status IN ('design_fee_paid', 'in_design', 'proof_sent', 'awaiting_approval') THEN 'paid'
    ELSE 'pending'
  END,
  wi.created_at,
  wi.updated_at
FROM work_items wi
WHERE wi.design_fee_order_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM customer_orders co
    WHERE co.shopify_order_id = wi.design_fee_order_id
  );

-- Update customer aggregates for all existing customers
DO $$
DECLARE
  cust_id UUID;
BEGIN
  FOR cust_id IN SELECT DISTINCT customer_id FROM customer_orders WHERE customer_id IS NOT NULL
  LOOP
    PERFORM update_customer_aggregates(cust_id);
  END LOOP;
END $$;

-- ============================================================================
-- 6. RLS POLICIES
-- ============================================================================

ALTER TABLE customer_orders ENABLE ROW LEVEL SECURITY;

-- All authenticated users can view/manage customer orders
CREATE POLICY "All authenticated users can view customer orders"
  ON customer_orders FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "All authenticated users can insert customer orders"
  ON customer_orders FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "All authenticated users can update customer orders"
  ON customer_orders FOR UPDATE
  TO authenticated
  USING (true);

CREATE POLICY "All authenticated users can delete customer orders"
  ON customer_orders FOR DELETE
  TO authenticated
  USING (true);
