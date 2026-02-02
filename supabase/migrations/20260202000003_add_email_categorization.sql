-- Email Categorization System Migration
-- Adds Gmail-style email filtering with Primary/Promotional/Spam categories
-- Created: 2026-02-02

-- ============================================================================
-- STEP 1: Add new columns to communications table
-- ============================================================================

-- Add category column for Gmail-style filtering
ALTER TABLE communications
ADD COLUMN category TEXT DEFAULT 'primary'
CHECK (category IN ('primary', 'promotional', 'spam', 'notifications'));

-- Add read/unread tracking
ALTER TABLE communications
ADD COLUMN is_read BOOLEAN DEFAULT FALSE;

-- Add index for category filtering (performance optimization)
CREATE INDEX idx_communications_category ON communications(category, received_at DESC NULLS LAST)
WHERE direction = 'inbound';

-- Add index for unread emails
CREATE INDEX idx_communications_unread ON communications(is_read)
WHERE is_read = FALSE AND direction = 'inbound';

-- Add combined index for common queries (category + triage_status)
CREATE INDEX idx_communications_category_triage ON communications(category, triage_status, received_at DESC NULLS LAST);

-- ============================================================================
-- STEP 2: Create email_filters table for user-managed rules
-- ============================================================================

CREATE TABLE email_filters (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

  -- Filter target (email or domain)
  sender_email TEXT,
  sender_domain TEXT,

  -- Filter action
  category TEXT NOT NULL CHECK (category IN ('primary', 'promotional', 'spam', 'notifications')),

  -- Auto-archive option (for spam/promotional)
  auto_archive BOOLEAN DEFAULT FALSE,

  -- Who created this filter
  created_by_user_id UUID REFERENCES users(id) ON DELETE SET NULL,

  -- Filter metadata
  is_active BOOLEAN DEFAULT TRUE,
  match_count INTEGER DEFAULT 0, -- Track how many times this filter has been applied
  last_matched_at TIMESTAMPTZ,

  -- Notes (optional explanation)
  notes TEXT,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- Ensure at least one of sender_email or sender_domain is set
  CHECK (sender_email IS NOT NULL OR sender_domain IS NOT NULL)
);

-- Indexes for fast filter lookups
CREATE INDEX idx_email_filters_sender_email ON email_filters(sender_email)
WHERE sender_email IS NOT NULL AND is_active = TRUE;

CREATE INDEX idx_email_filters_sender_domain ON email_filters(sender_domain)
WHERE sender_domain IS NOT NULL AND is_active = TRUE;

CREATE INDEX idx_email_filters_active ON email_filters(is_active, category);

-- Add updated_at trigger
CREATE TRIGGER update_email_filters_updated_at
BEFORE UPDATE ON email_filters
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- STEP 3: Add helper function to apply email filters
-- ============================================================================

CREATE OR REPLACE FUNCTION apply_email_filters(p_from_email TEXT)
RETURNS TABLE(matched_category TEXT, filter_id UUID) AS $$
DECLARE
  v_domain TEXT;
  v_result RECORD;
BEGIN
  -- Extract domain from email
  v_domain := split_part(p_from_email, '@', 2);

  -- Check for exact email match first (higher priority)
  SELECT category, id INTO v_result
  FROM email_filters
  WHERE sender_email = p_from_email
    AND is_active = TRUE
  ORDER BY created_at DESC
  LIMIT 1;

  IF FOUND THEN
    -- Update match count and last_matched_at
    UPDATE email_filters
    SET match_count = match_count + 1,
        last_matched_at = NOW()
    WHERE id = v_result.id;

    RETURN QUERY SELECT v_result.category, v_result.id;
    RETURN;
  END IF;

  -- Check for domain match
  SELECT category, id INTO v_result
  FROM email_filters
  WHERE sender_domain = v_domain
    AND is_active = TRUE
  ORDER BY created_at DESC
  LIMIT 1;

  IF FOUND THEN
    -- Update match count and last_matched_at
    UPDATE email_filters
    SET match_count = match_count + 1,
        last_matched_at = NOW()
    WHERE id = v_result.id;

    RETURN QUERY SELECT v_result.category, v_result.id;
    RETURN;
  END IF;

  -- No filter found, return NULL (will default to 'primary')
  RETURN;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- STEP 4: Seed default spam/promotional filters
-- ============================================================================

-- Common notification senders (auto-categorize as 'notifications')
INSERT INTO email_filters (sender_email, category, notes) VALUES
  ('noreply@github.com', 'notifications', 'GitHub notifications'),
  ('notifications@slack.com', 'notifications', 'Slack notifications'),
  ('no-reply@accounts.google.com', 'notifications', 'Google account notifications'),
  ('noreply@medium.com', 'notifications', 'Medium notifications'),
  ('notify@twitter.com', 'notifications', 'Twitter/X notifications');

-- Common promotional/marketing domains (domain-level filters)
INSERT INTO email_filters (sender_domain, category, notes) VALUES
  ('newsletter.com', 'promotional', 'Newsletter domain'),
  ('marketing.com', 'promotional', 'Marketing domain'),
  ('promo.com', 'promotional', 'Promotional domain'),
  ('updates.com', 'promotional', 'Updates domain'),
  ('campaigns.com', 'promotional', 'Campaign domain');

-- Common spam patterns (exact email matches)
INSERT INTO email_filters (sender_email, category, notes) VALUES
  ('mailer-daemon@', 'spam', 'Mail delivery failures'),
  ('postmaster@', 'spam', 'Postmaster messages'),
  ('bounce@', 'spam', 'Bounce notifications');

-- ============================================================================
-- STEP 5: Backfill existing emails to 'primary' category
-- ============================================================================

-- All existing emails default to 'primary' (already set by DEFAULT constraint)
-- But we can apply filters retroactively if needed

-- Optional: Apply filters to existing untriaged emails
UPDATE communications c
SET category = (
  SELECT matched_category
  FROM apply_email_filters(c.from_email)
  LIMIT 1
)
WHERE direction = 'inbound'
  AND category = 'primary' -- Only update those still at default
  AND triage_status = 'untriaged';

-- ============================================================================
-- STEP 6: Add comment documentation
-- ============================================================================

COMMENT ON COLUMN communications.category IS 'Email category for Gmail-style filtering: primary (customer inquiries), promotional (marketing), spam (junk), notifications (automated)';
COMMENT ON COLUMN communications.is_read IS 'Whether this email has been read by a user';
COMMENT ON TABLE email_filters IS 'User-defined rules for automatically categorizing incoming emails by sender';
COMMENT ON FUNCTION apply_email_filters IS 'Helper function to find matching email filter and return category. Updates filter match statistics.';
