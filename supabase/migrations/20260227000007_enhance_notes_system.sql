-- Enhance notes system with starring and user tracking
-- =================================================================

-- Add starred column for favoriting notes
ALTER TABLE work_item_notes
ADD COLUMN IF NOT EXISTS starred BOOLEAN DEFAULT FALSE;

-- Add created_by_user_id to link to users table
ALTER TABLE work_item_notes
ADD COLUMN IF NOT EXISTS created_by_user_id UUID REFERENCES users(id) ON DELETE SET NULL;

-- Add is_internal flag (true = internal note, false = sent to customer)
ALTER TABLE work_item_notes
ADD COLUMN IF NOT EXISTS is_internal BOOLEAN DEFAULT TRUE;

-- Create index for starred notes
CREATE INDEX IF NOT EXISTS idx_work_item_notes_starred
ON work_item_notes(work_item_id)
WHERE starred = TRUE;

-- Create index for user's notes
CREATE INDEX IF NOT EXISTS idx_work_item_notes_user
ON work_item_notes(created_by_user_id);

-- Backfill created_by_user_id from author_email where possible
UPDATE work_item_notes wn
SET created_by_user_id = u.id
FROM users u
WHERE wn.author_email = u.email
  AND wn.created_by_user_id IS NULL;
