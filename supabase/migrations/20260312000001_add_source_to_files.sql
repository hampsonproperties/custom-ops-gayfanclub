-- Add source column to files table to track where each file came from
-- Values: 'customify_api', 'shopify_property', 'manual_upload', 'email_attachment'
ALTER TABLE files ADD COLUMN IF NOT EXISTS source TEXT;

-- Backfill existing files based on current data
-- Files with uploaded_by_user_id are manual uploads
UPDATE files SET source = 'manual_upload' WHERE uploaded_by_user_id IS NOT NULL AND source IS NULL;

-- Files with storage_bucket = 'customify' or note containing 'Customify' are from Shopify property parsing
UPDATE files SET source = 'shopify_property' WHERE source IS NULL AND (
  storage_bucket = 'customify' OR note ILIKE '%customify%'
);

-- Everything else that was auto-imported
UPDATE files SET source = 'shopify_property' WHERE source IS NULL AND uploaded_by_user_id IS NULL;

-- Default for new manual uploads
-- (No default set — code will explicitly set source on insert)
