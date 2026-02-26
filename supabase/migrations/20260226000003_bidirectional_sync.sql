-- ============================================================================
-- Phase 3: Bi-Directional Sync
-- Migration: 20260226000003_bidirectional_sync.sql
--
-- Creates sync queue for reliably pushing changes back to Shopify
-- Implements retry logic with exponential backoff
-- Enables syncing notes, tags, fulfillments, and metafields
-- ============================================================================

-- ============================================================================
-- SHOPIFY_SYNC_QUEUE
-- Reliable queue for pushing changes back to Shopify with retry logic
-- ============================================================================

CREATE TABLE IF NOT EXISTS shopify_sync_queue (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

  -- What to sync
  sync_type TEXT NOT NULL CHECK (sync_type IN ('customer_note', 'customer_tags', 'order_fulfillment', 'order_metafield')),

  -- Target in Shopify
  shopify_resource_type TEXT NOT NULL CHECK (shopify_resource_type IN ('customer', 'order', 'fulfillment')),
  shopify_resource_id TEXT NOT NULL,

  -- Payload data
  sync_payload JSONB NOT NULL,

  -- Links for context
  work_item_id UUID REFERENCES work_items(id) ON DELETE SET NULL,
  customer_id UUID REFERENCES customers(id) ON DELETE SET NULL,

  -- Status tracking
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed', 'cancelled')),

  -- Retry logic
  retry_count INTEGER DEFAULT 0,
  max_retries INTEGER DEFAULT 5,
  next_retry_at TIMESTAMPTZ,
  last_retry_at TIMESTAMPTZ,

  -- Results
  shopify_response JSONB,
  error_message TEXT,
  error_code TEXT,

  -- Timestamps
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for shopify_sync_queue
CREATE INDEX IF NOT EXISTS idx_shopify_sync_queue_status ON shopify_sync_queue(status);
CREATE INDEX IF NOT EXISTS idx_shopify_sync_queue_pending ON shopify_sync_queue(next_retry_at)
  WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS idx_shopify_sync_queue_work_item ON shopify_sync_queue(work_item_id);
CREATE INDEX IF NOT EXISTS idx_shopify_sync_queue_type ON shopify_sync_queue(sync_type);
CREATE INDEX IF NOT EXISTS idx_shopify_sync_queue_created ON shopify_sync_queue(created_at DESC);

-- Comments
COMMENT ON TABLE shopify_sync_queue IS 'Queue for syncing data back to Shopify with retry logic';
COMMENT ON COLUMN shopify_sync_queue.sync_payload IS 'Data to sync (varies by sync_type)';
COMMENT ON COLUMN shopify_sync_queue.next_retry_at IS 'When to retry (exponential backoff)';
COMMENT ON COLUMN shopify_sync_queue.shopify_response IS 'Response from Shopify API (success or error)';

-- ============================================================================
-- RLS POLICIES
-- ============================================================================

ALTER TABLE shopify_sync_queue ENABLE ROW LEVEL SECURITY;

-- All authenticated users can view sync queue
CREATE POLICY "All authenticated users can view sync queue"
  ON shopify_sync_queue FOR SELECT
  TO authenticated
  USING (true);

-- All authenticated users can insert to sync queue
CREATE POLICY "All authenticated users can insert to sync queue"
  ON shopify_sync_queue FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- All authenticated users can update sync queue (for processing)
CREATE POLICY "All authenticated users can update sync queue"
  ON shopify_sync_queue FOR UPDATE
  TO authenticated
  USING (true);

-- All authenticated users can delete from sync queue
CREATE POLICY "All authenticated users can delete from sync queue"
  ON shopify_sync_queue FOR DELETE
  TO authenticated
  USING (true);
