-- Add email signature fields to users table
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS email_signature_html TEXT,
  ADD COLUMN IF NOT EXISTS signature_name TEXT,
  ADD COLUMN IF NOT EXISTS signature_title TEXT,
  ADD COLUMN IF NOT EXISTS signature_logo_url TEXT;

COMMENT ON COLUMN users.email_signature_html IS 'Full rendered HTML email signature for outgoing emails';
COMMENT ON COLUMN users.signature_name IS 'Display name for signature (may differ from full_name)';
COMMENT ON COLUMN users.signature_title IS 'Job title shown in signature';
COMMENT ON COLUMN users.signature_logo_url IS 'Public URL for logo image in signature';
