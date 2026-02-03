-- Add external_url column to files table to preserve original Customify URLs
-- This allows us to store our own copy in Supabase while keeping the original URL for reference

ALTER TABLE files ADD COLUMN IF NOT EXISTS external_url text;

-- Add comment for documentation
COMMENT ON COLUMN files.external_url IS 'Original external URL (e.g., Customify S3 URL) before we downloaded and stored our own copy';

-- Add index for finding files by external URL
CREATE INDEX IF NOT EXISTS idx_files_external_url ON files(external_url) WHERE external_url IS NOT NULL;
