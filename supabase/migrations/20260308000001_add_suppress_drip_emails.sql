-- Add suppress_drip_emails flag to work_items table
-- When true, the drip email cron will skip this work item entirely
ALTER TABLE work_items
  ADD COLUMN IF NOT EXISTS suppress_drip_emails BOOLEAN NOT NULL DEFAULT false;

COMMENT ON COLUMN work_items.suppress_drip_emails IS 'When true, drip email cron skips this work item (used for retroactive batching)';
