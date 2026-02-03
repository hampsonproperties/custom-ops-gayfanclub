-- Add actioned_at to communications table for inbox reply tracking

ALTER TABLE communications
  ADD COLUMN IF NOT EXISTS actioned_at TIMESTAMPTZ;

-- Add comment to explain the column
COMMENT ON COLUMN communications.actioned_at IS 'Timestamp when an inbound email was acted upon (replied to, work item updated, etc.)';

-- Create index for querying unactioned inbound emails
CREATE INDEX idx_communications_actioned
  ON communications(direction, actioned_at, work_item_id)
  WHERE direction = 'inbound' AND actioned_at IS NULL;

-- Create index for recently actioned emails
CREATE INDEX idx_communications_recently_actioned
  ON communications(actioned_at DESC)
  WHERE actioned_at IS NOT NULL;
