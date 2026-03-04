-- ============================================================================
-- Migration: Create Email Filters for Domain-Based Categorization
-- Purpose: Replace keyword-based categorization with domain allow/block lists
-- Created: 2026-02-19
-- ============================================================================

-- 1. CREATE EMAIL_FILTERS TABLE
-- ============================================================================
CREATE TABLE email_filters (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

  -- Filter configuration
  filter_type TEXT NOT NULL CHECK (filter_type IN ('domain', 'sender', 'subject_keyword')),
  pattern TEXT NOT NULL, -- Domain (e.g. '@loreal.com'), email, or keyword
  action TEXT NOT NULL CHECK (action IN ('categorize', 'block', 'prioritize')),
  target_category TEXT, -- Where to categorize (e.g. 'primary', 'other', 'spam')

  -- Metadata
  name TEXT NOT NULL,
  description TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  priority INTEGER DEFAULT 100, -- Lower = higher priority

  -- Stats
  match_count INTEGER DEFAULT 0,
  last_matched_at TIMESTAMPTZ,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_email_filters_active ON email_filters(is_active) WHERE is_active = TRUE;
CREATE INDEX idx_email_filters_type ON email_filters(filter_type);
CREATE INDEX idx_email_filters_priority ON email_filters(priority);

-- 2. SEED DEFAULT FILTERS
-- ============================================================================

-- Known spam domains (block)
INSERT INTO email_filters (filter_type, pattern, action, target_category, name, description, priority) VALUES
  ('domain', '@360onlineprint.com', 'categorize', 'spam', 'Block 360onlineprint spam', 'Marketing spam from 360onlineprint', 10),
  ('domain', '@mailchimp.com', 'categorize', 'other', 'Auto-archive Mailchimp', 'Mailchimp marketing emails', 20),
  ('domain', '@shopify.com', 'categorize', 'other', 'Shopify notifications', 'Order confirmations and updates', 30),
  ('domain', '@noreply', 'categorize', 'other', 'No-reply senders', 'Automated notifications', 40),
  ('domain', '@no-reply', 'categorize', 'other', 'No-reply senders (hyphen)', 'Automated notifications', 40);

-- Known customer domains (prioritize and categorize as primary)
INSERT INTO email_filters (filter_type, pattern, action, target_category, name, description, priority) VALUES
  ('domain', '@loreal.com', 'categorize', 'primary', 'L\'Oreal customer emails', 'Enterprise customer - high priority', 5),
  ('domain', '@luxottica.com', 'categorize', 'primary', 'Luxottica customer emails', 'Enterprise customer', 5),
  ('domain', '@ritzcarltoncruise.com', 'categorize', 'primary', 'Ritz Carlton customer emails', 'VIP customer', 5);

-- Form providers (keep as primary even if from no-reply)
INSERT INTO email_filters (filter_type, pattern, action, target_category, name, description, priority) VALUES
  ('domain', '@powerfulform.com', 'categorize', 'primary', 'PowerfulForm submissions', 'New lead form submissions', 1),
  ('sender', 'forms-noreply@google.com', 'categorize', 'primary', 'Google Forms submissions', 'New lead form submissions', 1),
  ('domain', '@formstack.com', 'categorize', 'primary', 'Formstack submissions', 'New lead form submissions', 1),
  ('domain', '@typeform.com', 'categorize', 'primary', 'Typeform submissions', 'New lead form submissions', 1),
  ('domain', '@jotform.com', 'categorize', 'primary', 'Jotform submissions', 'New lead form submissions', 1);

-- Support-related subject keywords (categorize as support)
INSERT INTO email_filters (filter_type, pattern, action, target_category, name, description, priority) VALUES
  ('subject_keyword', 'missing', 'categorize', 'support', 'Missing items', 'Customer reporting missing items', 50),
  ('subject_keyword', 'damaged', 'categorize', 'support', 'Damaged items', 'Customer reporting damaged items', 50),
  ('subject_keyword', 'refund', 'categorize', 'support', 'Refund requests', 'Customer requesting refund', 50),
  ('subject_keyword', 'wrong', 'categorize', 'support', 'Wrong items', 'Customer received wrong items', 50),
  ('subject_keyword', 'problem', 'categorize', 'support', 'Problems', 'General problem reports', 60),
  ('subject_keyword', 'issue', 'categorize', 'support', 'Issues', 'General issue reports', 60);

-- 3. CREATE FUNCTION TO APPLY EMAIL FILTERS
-- ============================================================================
CREATE OR REPLACE FUNCTION apply_email_filters(
  p_from_email TEXT,
  p_subject TEXT DEFAULT NULL
)
RETURNS TABLE (
  matched_category TEXT,
  filter_id UUID
)
LANGUAGE plpgsql
AS $$
DECLARE
  v_filter RECORD;
BEGIN
  -- Apply filters in priority order (lower = higher priority)
  FOR v_filter IN
    SELECT *
    FROM email_filters
    WHERE is_active = TRUE
    ORDER BY priority ASC, created_at ASC
  LOOP
    -- Check domain filters
    IF v_filter.filter_type = 'domain' THEN
      IF p_from_email ILIKE '%' || v_filter.pattern THEN
        -- Update match stats
        UPDATE email_filters
        SET
          match_count = match_count + 1,
          last_matched_at = NOW()
        WHERE id = v_filter.id;

        RETURN QUERY SELECT v_filter.target_category, v_filter.id;
        RETURN;
      END IF;
    END IF;

    -- Check sender filters (exact match)
    IF v_filter.filter_type = 'sender' THEN
      IF LOWER(p_from_email) = LOWER(v_filter.pattern) THEN
        UPDATE email_filters
        SET
          match_count = match_count + 1,
          last_matched_at = NOW()
        WHERE id = v_filter.id;

        RETURN QUERY SELECT v_filter.target_category, v_filter.id;
        RETURN;
      END IF;
    END IF;

    -- Check subject keyword filters (case-insensitive)
    IF v_filter.filter_type = 'subject_keyword' AND p_subject IS NOT NULL THEN
      IF p_subject ILIKE '%' || v_filter.pattern || '%' THEN
        UPDATE email_filters
        SET
          match_count = match_count + 1,
          last_matched_at = NOW()
        WHERE id = v_filter.id;

        RETURN QUERY SELECT v_filter.target_category, v_filter.id;
        RETURN;
      END IF;
    END IF;
  END LOOP;

  -- No filter matched, return NULL
  RETURN;
END;
$$;

COMMENT ON FUNCTION apply_email_filters IS
'Applies email filters in priority order. Returns the first matching filter''s category and ID.';

-- 4. CREATE EMAIL FILTER STATS VIEW
-- ============================================================================
CREATE OR REPLACE VIEW email_filter_stats AS
SELECT
  ef.id,
  ef.name,
  ef.filter_type,
  ef.pattern,
  ef.target_category,
  ef.match_count,
  ef.last_matched_at,
  ef.is_active,
  ef.priority
FROM email_filters ef
ORDER BY ef.match_count DESC;

COMMENT ON VIEW email_filter_stats IS
'Statistics for email filters showing which filters are matching most often.';

-- 5. ADD UPDATED_AT TRIGGER
-- ============================================================================
CREATE TRIGGER update_email_filters_updated_at
BEFORE UPDATE ON email_filters
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

-- 6. LOG MIGRATION RESULTS
-- ============================================================================
DO $$
DECLARE
  filter_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO filter_count FROM email_filters;

  RAISE NOTICE 'Email Filters Migration Complete';
  RAISE NOTICE '===================================';
  RAISE NOTICE 'Created table: email_filters';
  RAISE NOTICE 'Created function: apply_email_filters()';
  RAISE NOTICE 'Created view: email_filter_stats';
  RAISE NOTICE '';
  RAISE NOTICE 'Seeded % default filters:', filter_count;
  RAISE NOTICE '  - Spam domains (360onlineprint, etc.)';
  RAISE NOTICE '  - Enterprise customers (L''Oreal, Luxottica, etc.)';
  RAISE NOTICE '  - Form providers (PowerfulForm, Google Forms, etc.)';
  RAISE NOTICE '  - Support keywords (missing, damaged, refund, etc.)';
  RAISE NOTICE '';
  RAISE NOTICE 'Email categorization now uses:';
  RAISE NOTICE '  1. Domain-based filtering (priority 1-50)';
  RAISE NOTICE '  2. Sender-based filtering';
  RAISE NOTICE '  3. Subject keyword filtering (priority 50-100)';
  RAISE NOTICE '  4. Fallback to "primary" if no match';
END $$;
