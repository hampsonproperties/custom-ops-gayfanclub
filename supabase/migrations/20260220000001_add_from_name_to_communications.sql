-- ============================================================================
-- Migration: Add from_name column to communications table
-- Purpose: Store sender's display name separate from email address
-- Created: 2026-02-20
-- ============================================================================

-- Add from_name column to store sender's display name
ALTER TABLE communications
ADD COLUMN from_name TEXT;

-- Add index for faster lookups by name
CREATE INDEX idx_communications_from_name ON communications(from_name);

-- Add comment
COMMENT ON COLUMN communications.from_name IS 'Display name of the sender (e.g., "John Doe" from "John Doe <john@example.com>")';

-- Summary
DO $$
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'Migration Complete: from_name Column Added';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'Added from_name column to communications table';
  RAISE NOTICE 'Existing emails will have NULL for from_name';
  RAISE NOTICE 'New emails will populate from_name from Microsoft Graph API';
  RAISE NOTICE '========================================';
END $$;
