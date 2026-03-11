-- Add created_by_user_id to work_items for tracking who created a lead
-- This shows up on the activity timeline as "Created by [Name]"
ALTER TABLE work_items
ADD COLUMN IF NOT EXISTS created_by_user_id UUID REFERENCES users(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_work_items_created_by
ON work_items(created_by_user_id);
