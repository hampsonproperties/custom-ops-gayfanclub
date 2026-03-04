-- Migration: Add unique constraint on work_items.shopify_order_number
-- Sprint 3: Prevent duplicate work items from Shopify webhook race conditions
-- Date: 2026-03-03
--
-- This migration:
-- 1. Reassigns orphaned child records (communications, batch_items) from duplicate work items to keepers
-- 2. Deletes duplicate work items (status_events, files, reminder_queue cascade automatically)
-- 3. Adds a unique partial index on shopify_order_number (WHERE NOT NULL)
-- 4. Adds a unique partial index on design_fee_order_number (WHERE NOT NULL)

-- ============================================================
-- STEP 1: Merge duplicate shopify_order_number work items
-- ============================================================

-- #6490 (3 copies): Keep 77284c6f (has batch_item link)
-- Reassign 16 communications from c8b364c6 to keeper
UPDATE communications
SET work_item_id = '77284c6f-8e2e-4109-bd5a-2a716ac4f2fa'
WHERE work_item_id = 'c8b364c6-4f74-4110-aefd-ca02e38a9052';

-- Delete duplicates for #6490 (cascade deletes status_events, files, reminder_queue)
DELETE FROM work_items
WHERE id IN (
  '31f4bef1-e923-48c0-a254-9028c1745d6e',
  'c8b364c6-4f74-4110-aefd-ca02e38a9052'
);

-- #6373 (2 copies): Keep 1aa2eda6 (first one). Other has no linked data.
DELETE FROM work_items
WHERE id = '8c5158c5-abf4-4f9a-976b-5ed8151b7064';

-- #6489 (2 copies): Keep 282b27c0 (batched, more advanced status)
-- Reassign 1 communication from 5c98b444 to keeper
UPDATE communications
SET work_item_id = '282b27c0-07fa-416f-ad07-845400349a51'
WHERE work_item_id = '5c98b444-ac85-44f3-89c6-90c6de766b9b';

DELETE FROM work_items
WHERE id = '5c98b444-ac85-44f3-89c6-90c6de766b9b';

-- #6503 (2 copies): Keep 296c6adb (first one). Other has no linked data.
DELETE FROM work_items
WHERE id = '89b7ba04-d9f0-47e9-ab91-cd8378c1ce5b';

-- ============================================================
-- STEP 2: Merge duplicate design_fee_order_number work items
-- ============================================================

-- #6510 (2 copies): Keep faa42e63 (design_fee_paid, more advanced status)
-- Other has no linked data.
DELETE FROM work_items
WHERE id = '1efb8e81-0085-447a-872c-fdeba9e436eb';

-- ============================================================
-- STEP 3: Add unique partial indexes
-- ============================================================

-- Prevent duplicate shopify_order_number values
-- Partial index: only applies to rows where the column is NOT NULL
CREATE UNIQUE INDEX IF NOT EXISTS idx_work_items_unique_shopify_order_number
ON work_items (shopify_order_number)
WHERE shopify_order_number IS NOT NULL;

-- Prevent duplicate design_fee_order_number values
CREATE UNIQUE INDEX IF NOT EXISTS idx_work_items_unique_design_fee_order_number
ON work_items (design_fee_order_number)
WHERE design_fee_order_number IS NOT NULL;
