-- ============================================================================
-- Phase 1: Customer Notes, Tags, and Payment Tracking
-- Migration: 20260226000001_shopify_notes_sync.sql
-- ============================================================================

-- ============================================================================
-- 1. ENHANCE WORK_ITEM_NOTES FOR SOURCE TRACKING
-- ============================================================================

ALTER TABLE work_item_notes
ADD COLUMN IF NOT EXISTS source TEXT DEFAULT 'manual',
ADD COLUMN IF NOT EXISTS external_id TEXT,
ADD COLUMN IF NOT EXISTS synced_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_work_item_notes_external_id
  ON work_item_notes(external_id) WHERE external_id IS NOT NULL;

COMMENT ON COLUMN work_item_notes.source IS 'Note source: manual, shopify, system';
COMMENT ON COLUMN work_item_notes.external_id IS 'External reference ID (e.g., Shopify customer ID)';
COMMENT ON COLUMN work_item_notes.synced_at IS 'Last sync timestamp from external system';

-- ============================================================================
-- 2. CREATE SHOPIFY TAG MAPPINGS TABLE
-- Map Shopify customer tags to internal tags with flexible pattern matching
-- ============================================================================

CREATE TABLE IF NOT EXISTS shopify_tag_mappings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  shopify_tag_pattern TEXT NOT NULL,
  internal_tag_id UUID REFERENCES tags(id) ON DELETE CASCADE,
  match_type TEXT DEFAULT 'exact' CHECK (match_type IN ('exact', 'contains', 'regex')),
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(shopify_tag_pattern, internal_tag_id)
);

CREATE INDEX IF NOT EXISTS idx_shopify_tag_mappings_active
  ON shopify_tag_mappings(is_active) WHERE is_active = true;

COMMENT ON TABLE shopify_tag_mappings IS 'Maps Shopify customer tags to internal tags';
COMMENT ON COLUMN shopify_tag_mappings.match_type IS 'How to match: exact, contains, or regex';

-- ============================================================================
-- 3. SEED COMMON TAG MAPPINGS
-- Create mappings for common customer tags (only if tags exist)
-- ============================================================================

-- Insert common mappings for tags that exist in the system
INSERT INTO shopify_tag_mappings (shopify_tag_pattern, internal_tag_id, match_type)
SELECT
  pattern,
  (SELECT id FROM tags WHERE name = tag_name LIMIT 1),
  'contains'
FROM (VALUES
  ('vip', 'VIP'),
  ('rush', 'Rush'),
  ('wholesale', 'Wholesale'),
  ('repeat', 'Repeat Customer'),
  ('event', 'Event')
) AS mappings(pattern, tag_name)
WHERE (SELECT id FROM tags WHERE name = tag_name LIMIT 1) IS NOT NULL
ON CONFLICT (shopify_tag_pattern, internal_tag_id) DO NOTHING;

-- ============================================================================
-- 4. ENHANCE WORK_ITEMS FOR PAYMENT HISTORY
-- Store detailed payment transaction history beyond current financial_status
-- ============================================================================

ALTER TABLE work_items
ADD COLUMN IF NOT EXISTS payment_history JSONB DEFAULT '[]'::jsonb;

COMMENT ON COLUMN work_items.payment_history IS 'Array of payment events: [{transaction_id, amount, status, kind, paid_at, refunded_at}]';

-- Add GIN index for JSON queries
CREATE INDEX IF NOT EXISTS idx_work_items_payment_history
  ON work_items USING GIN (payment_history);

-- ============================================================================
-- 5. RLS POLICIES FOR NEW TABLES
-- ============================================================================

ALTER TABLE shopify_tag_mappings ENABLE ROW LEVEL SECURITY;

-- All authenticated users can view tag mappings
CREATE POLICY "All authenticated users can view tag mappings"
  ON shopify_tag_mappings FOR SELECT
  TO authenticated
  USING (true);

-- All authenticated users can manage tag mappings (simplifying from admin-only)
CREATE POLICY "Authenticated users can insert tag mappings"
  ON shopify_tag_mappings FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update tag mappings"
  ON shopify_tag_mappings FOR UPDATE
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can delete tag mappings"
  ON shopify_tag_mappings FOR DELETE
  TO authenticated
  USING (true);
