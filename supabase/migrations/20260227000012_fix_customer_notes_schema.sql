-- Fix customer_notes schema to match component expectations
-- Rename 'note' column to 'content' and add missing columns
-- =================================================================

-- Add missing columns if they don't exist
ALTER TABLE customer_notes
ADD COLUMN IF NOT EXISTS content TEXT;

ALTER TABLE customer_notes
ADD COLUMN IF NOT EXISTS starred BOOLEAN DEFAULT FALSE;

ALTER TABLE customer_notes
ADD COLUMN IF NOT EXISTS is_internal BOOLEAN DEFAULT TRUE;

-- Copy data from 'note' to 'content' if 'note' column exists
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'customer_notes' AND column_name = 'note'
  ) THEN
    -- Copy data from note to content where content is null
    UPDATE customer_notes SET content = note WHERE content IS NULL;

    -- Drop the old 'note' column
    ALTER TABLE customer_notes DROP COLUMN note;
  END IF;
END $$;

-- Ensure content column is NOT NULL (after data migration)
ALTER TABLE customer_notes
ALTER COLUMN content SET NOT NULL;

-- Add index for starred notes if it doesn't exist
CREATE INDEX IF NOT EXISTS idx_customer_notes_starred
ON customer_notes(customer_id) WHERE starred = TRUE;

-- Add helpful comments
COMMENT ON COLUMN customer_notes.content IS 'The note content (plain text or markdown)';
COMMENT ON COLUMN customer_notes.starred IS 'Whether this note is starred/favorited';
COMMENT ON COLUMN customer_notes.is_internal IS 'Internal notes vs notes shared with customer';
