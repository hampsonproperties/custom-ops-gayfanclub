-- Add user attribution and project linking to communications
-- =================================================================

-- Add sent_by_user_id to track WHO sent each email
ALTER TABLE communications
ADD COLUMN IF NOT EXISTS sent_by_user_id UUID REFERENCES users(id) ON DELETE SET NULL;

-- Add work_item_id to link emails to specific projects
ALTER TABLE communications
ADD COLUMN IF NOT EXISTS work_item_id UUID REFERENCES work_items(id) ON DELETE SET NULL;

-- Add manually_tagged flag for emails manually assigned to projects
ALTER TABLE communications
ADD COLUMN IF NOT EXISTS manually_tagged BOOLEAN DEFAULT FALSE;

-- Create index for project emails
CREATE INDEX IF NOT EXISTS idx_communications_work_item
ON communications(work_item_id)
WHERE work_item_id IS NOT NULL;

-- Create index for user's sent emails
CREATE INDEX IF NOT EXISTS idx_communications_sent_by_user
ON communications(sent_by_user_id);

-- Add helpful comments
COMMENT ON COLUMN communications.sent_by_user_id IS 'Which team member sent this email (for user attribution)';
COMMENT ON COLUMN communications.work_item_id IS 'Link email to specific project/work item';
COMMENT ON COLUMN communications.manually_tagged IS 'Whether email was manually tagged to this project by user';
