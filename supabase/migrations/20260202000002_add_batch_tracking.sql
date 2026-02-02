-- Add tracking number to batches
ALTER TABLE batches ADD COLUMN IF NOT EXISTS tracking_number text;
ALTER TABLE batches ADD COLUMN IF NOT EXISTS shipped_at timestamptz;

-- Add index for tracking number lookups
CREATE INDEX IF NOT EXISTS idx_batches_tracking_number ON batches(tracking_number) WHERE tracking_number IS NOT NULL;

COMMENT ON COLUMN batches.tracking_number IS 'Shipping tracking number for this batch';
COMMENT ON COLUMN batches.shipped_at IS 'Timestamp when batch was marked as shipped';
