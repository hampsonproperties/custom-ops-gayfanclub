-- Fix webhook_events processing_status constraint
-- The code uses: pending, processing, completed, skipped, failed
-- But the schema only allowed: received, processed, failed
-- This was causing all webhooks to fail with constraint violations

-- Drop the old constraint
ALTER TABLE webhook_events DROP CONSTRAINT IF EXISTS webhook_events_processing_status_check;

-- Add new constraint with all the statuses the code uses
ALTER TABLE webhook_events
ADD CONSTRAINT webhook_events_processing_status_check
CHECK (processing_status IN ('pending', 'processing', 'completed', 'skipped', 'failed', 'received', 'processed'));

-- Update default value to match what the code expects
ALTER TABLE webhook_events
ALTER COLUMN processing_status SET DEFAULT 'pending';

-- Comment explaining the statuses
COMMENT ON COLUMN webhook_events.processing_status IS 'Webhook processing status: pending (just received), processing (being worked on), completed (success), skipped (ignored), failed (error), received/processed (legacy values)';
