-- Add suppress_drip_emails column if missing (previous migration may not have been applied)
-- then change default to TRUE so all work items suppress drip emails by default.
-- To send drip emails, explicitly enable per work item.

ALTER TABLE work_items
  ADD COLUMN IF NOT EXISTS suppress_drip_emails BOOLEAN NOT NULL DEFAULT true;

-- If the column already existed with default false, change it
ALTER TABLE work_items ALTER COLUMN suppress_drip_emails SET DEFAULT true;

-- Backfill all existing work items to suppressed
UPDATE work_items SET suppress_drip_emails = true WHERE suppress_drip_emails = false;

COMMENT ON COLUMN work_items.suppress_drip_emails IS 'Default true — drip emails are off unless explicitly enabled per work item';
