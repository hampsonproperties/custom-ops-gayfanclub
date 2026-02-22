-- Migration: Add email attachments support to files table
-- Date: 2026-02-22
-- Description: Add communication_id field and email_attachment kind to support auto-downloading email attachments

-- Add communication_id column to link files to specific emails
ALTER TABLE files
ADD COLUMN IF NOT EXISTS communication_id UUID REFERENCES communications(id) ON DELETE CASCADE;

-- Add index for querying files by communication
CREATE INDEX IF NOT EXISTS idx_files_communication_id
ON files(communication_id);

-- Update kind constraint to include email_attachment
ALTER TABLE files
DROP CONSTRAINT IF EXISTS files_kind_check;

ALTER TABLE files
ADD CONSTRAINT files_kind_check
CHECK (kind IN ('preview', 'design', 'proof', 'other', 'email_attachment'));

-- Make work_item_id nullable since email attachments may not be linked to a work item yet
ALTER TABLE files
ALTER COLUMN work_item_id DROP NOT NULL;

-- Add comments
COMMENT ON COLUMN files.communication_id IS 'Link to the email communication this file was attached to (for email attachments)';
COMMENT ON COLUMN files.work_item_id IS 'Link to work item. Nullable for email attachments that are not yet linked to a work item';
