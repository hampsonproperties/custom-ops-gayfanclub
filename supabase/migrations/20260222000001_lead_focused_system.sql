-- ============================================================================
-- LEAD-FOCUSED SYSTEM MIGRATION
-- Transforms system from email-focused to lead-focused CRM
-- ============================================================================

-- 1. INTERNAL NOTES SYSTEM
-- ============================================================================
CREATE TABLE IF NOT EXISTS work_item_notes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  work_item_id UUID NOT NULL REFERENCES work_items(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  author_email TEXT NOT NULL, -- Who wrote this note
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_work_item_notes_work_item ON work_item_notes(work_item_id);
CREATE INDEX idx_work_item_notes_created ON work_item_notes(created_at DESC);

-- 2. ASSIGNMENT SYSTEM
-- ============================================================================
ALTER TABLE work_items
ADD COLUMN IF NOT EXISTS assigned_to_email TEXT,
ADD COLUMN IF NOT EXISTS assigned_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS assigned_by_email TEXT;

CREATE INDEX idx_work_items_assigned ON work_items(assigned_to_email) WHERE closed_at IS NULL;

-- 3. TAGGING SYSTEM
-- ============================================================================
CREATE TABLE IF NOT EXISTS tags (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT UNIQUE NOT NULL,
  color TEXT DEFAULT '#3b82f6', -- Default blue
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS work_item_tags (
  work_item_id UUID NOT NULL REFERENCES work_items(id) ON DELETE CASCADE,
  tag_id UUID NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  PRIMARY KEY (work_item_id, tag_id)
);

CREATE INDEX idx_work_item_tags_work_item ON work_item_tags(work_item_id);
CREATE INDEX idx_work_item_tags_tag ON work_item_tags(tag_id);

-- Seed common tags
INSERT INTO tags (name, color) VALUES
  ('VIP', '#ef4444'),           -- Red
  ('Rush', '#f97316'),          -- Orange
  ('Event', '#8b5cf6'),         -- Purple
  ('Wholesale', '#06b6d4'),     -- Cyan
  ('Design-Heavy', '#ec4899'),  -- Pink
  ('Repeat Customer', '#10b981') -- Green
ON CONFLICT (name) DO NOTHING;

-- 4. VALUE TRACKING
-- ============================================================================
ALTER TABLE work_items
ADD COLUMN IF NOT EXISTS estimated_value DECIMAL(10,2),
ADD COLUMN IF NOT EXISTS actual_value DECIMAL(10,2);

CREATE INDEX idx_work_items_value ON work_items(estimated_value DESC NULLS LAST) WHERE closed_at IS NULL;

-- 5. ACTIVITY TRACKING
-- ============================================================================
ALTER TABLE work_items
ADD COLUMN IF NOT EXISTS last_activity_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();

CREATE INDEX idx_work_items_activity ON work_items(last_activity_at DESC) WHERE closed_at IS NULL;

-- Auto-update last_activity_at on any change
CREATE OR REPLACE FUNCTION update_work_item_activity()
RETURNS TRIGGER AS $$
BEGIN
  NEW.last_activity_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_work_item_activity ON work_items;
CREATE TRIGGER trigger_update_work_item_activity
  BEFORE UPDATE ON work_items
  FOR EACH ROW
  EXECUTE FUNCTION update_work_item_activity();

-- Also update when notes are added
CREATE OR REPLACE FUNCTION update_work_item_activity_on_note()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE work_items
  SET last_activity_at = NOW()
  WHERE id = NEW.work_item_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_note_updates_activity ON work_item_notes;
CREATE TRIGGER trigger_note_updates_activity
  AFTER INSERT ON work_item_notes
  FOR EACH ROW
  EXECUTE FUNCTION update_work_item_activity_on_note();

-- 6. AUTO-ARCHIVE JUNK CONVERSATIONS
-- ============================================================================
CREATE OR REPLACE FUNCTION auto_archive_junk_conversations()
RETURNS INTEGER AS $$
DECLARE
  archived_count INTEGER;
BEGIN
  -- Archive conversations that:
  -- 1. Are currently active
  -- 2. Have NO work item linked
  -- 3. Only contain junk emails (notifications/promotional/spam)

  WITH junk_conversations AS (
    SELECT DISTINCT c.conversation_id
    FROM communications c
    WHERE c.conversation_id IS NOT NULL
      AND c.category IN ('notifications', 'promotional', 'spam')
      AND NOT EXISTS (
        -- Make sure ALL emails in thread are junk
        SELECT 1 FROM communications c2
        WHERE c2.conversation_id = c.conversation_id
        AND c2.category = 'primary'
      )
  )
  UPDATE conversations
  SET status = 'archived'
  WHERE status = 'active'
    AND work_item_id IS NULL
    AND id IN (SELECT conversation_id FROM junk_conversations);

  GET DIAGNOSTICS archived_count = ROW_COUNT;
  RETURN archived_count;
END;
$$ LANGUAGE plpgsql;

-- Run it now to clean up existing junk
SELECT auto_archive_junk_conversations() as archived_conversations_count;

-- 7. TRIAGE STATUS HELPERS
-- ============================================================================
-- Update communications.triage_status when linked to work item
CREATE OR REPLACE FUNCTION auto_update_triage_status()
RETURNS TRIGGER AS $$
BEGIN
  -- If work_item_id is being set and triage_status is still 'untriaged'
  IF NEW.work_item_id IS NOT NULL AND OLD.work_item_id IS NULL AND NEW.triage_status = 'untriaged' THEN
    NEW.triage_status = 'attached';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_auto_triage ON communications;
CREATE TRIGGER trigger_auto_triage
  BEFORE UPDATE ON communications
  FOR EACH ROW
  WHEN (NEW.work_item_id IS DISTINCT FROM OLD.work_item_id)
  EXECUTE FUNCTION auto_update_triage_status();

-- 8. DASHBOARD VIEWS
-- ============================================================================

-- Sales Pipeline View (for dashboard)
CREATE OR REPLACE VIEW sales_pipeline AS
SELECT
  wi.*,
  -- Computed flags
  CASE
    WHEN wi.next_follow_up_at IS NOT NULL AND wi.next_follow_up_at < NOW() THEN true
    ELSE false
  END as is_overdue,
  CASE
    WHEN wi.next_follow_up_at IS NOT NULL
      AND wi.next_follow_up_at >= NOW()
      AND wi.next_follow_up_at < NOW() + INTERVAL '1 day' THEN true
    ELSE false
  END as is_due_today,
  -- Tags
  ARRAY_AGG(DISTINCT t.name) FILTER (WHERE t.name IS NOT NULL) as tag_names,
  ARRAY_AGG(DISTINCT t.color) FILTER (WHERE t.color IS NOT NULL) as tag_colors,
  -- Email count
  (SELECT COUNT(*) FROM communications WHERE work_item_id = wi.id) as email_count,
  -- Latest email preview
  (SELECT body_preview FROM communications WHERE work_item_id = wi.id ORDER BY received_at DESC LIMIT 1) as latest_email_preview
FROM work_items wi
LEFT JOIN work_item_tags wit ON wit.work_item_id = wi.id
LEFT JOIN tags t ON t.id = wit.tag_id
WHERE wi.closed_at IS NULL
  AND wi.status IN ('new_inquiry', 'quote_sent', 'design_fee_sent', 'invoice_sent', 'awaiting_payment')
GROUP BY wi.id;

-- Production Pipeline View (for dashboard)
CREATE OR REPLACE VIEW production_pipeline AS
SELECT
  wi.*,
  -- Tags
  ARRAY_AGG(DISTINCT t.name) FILTER (WHERE t.name IS NOT NULL) as tag_names,
  ARRAY_AGG(DISTINCT t.color) FILTER (WHERE t.color IS NOT NULL) as tag_colors,
  -- Days until event
  CASE
    WHEN wi.event_date IS NOT NULL THEN (wi.event_date::date - CURRENT_DATE::date)
    ELSE NULL
  END as days_until_event,
  -- File count
  (SELECT COUNT(*) FROM files WHERE work_item_id = wi.id) as file_count
FROM work_items wi
LEFT JOIN work_item_tags wit ON wit.work_item_id = wi.id
LEFT JOIN tags t ON t.id = wit.tag_id
WHERE wi.closed_at IS NULL
  AND wi.status IN ('needs_design_review', 'design_fee_paid', 'awaiting_customer_files',
                    'paid_ready_for_batch', 'deposit_paid_ready_for_batch',
                    'on_payment_terms_ready_for_batch', 'ready_for_batch', 'batched',
                    'in_progress', 'in_transit', 'shipped')
GROUP BY wi.id;

-- 9. GRANT PERMISSIONS
-- ============================================================================
GRANT ALL ON work_item_notes TO authenticated;
GRANT ALL ON tags TO authenticated;
GRANT ALL ON work_item_tags TO authenticated;

-- 10. SUMMARY
-- ============================================================================
DO $$
DECLARE
  notes_count INTEGER;
  archived_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO notes_count FROM work_item_notes;
  SELECT COUNT(*) INTO archived_count FROM conversations WHERE status = 'archived';

  RAISE NOTICE '';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'Lead-Focused System Migration Complete';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'Tables created:';
  RAISE NOTICE '  ✓ work_item_notes (internal notes)';
  RAISE NOTICE '  ✓ tags (VIP, Rush, Event, etc.)';
  RAISE NOTICE '  ✓ work_item_tags (many-to-many)';
  RAISE NOTICE '';
  RAISE NOTICE 'Fields added to work_items:';
  RAISE NOTICE '  ✓ assigned_to_email, assigned_at, assigned_by_email';
  RAISE NOTICE '  ✓ estimated_value, actual_value';
  RAISE NOTICE '  ✓ last_activity_at (auto-updates)';
  RAISE NOTICE '';
  RAISE NOTICE 'Views created:';
  RAISE NOTICE '  ✓ sales_pipeline';
  RAISE NOTICE '  ✓ production_pipeline';
  RAISE NOTICE '';
  RAISE NOTICE 'Junk conversations archived: %', archived_count;
  RAISE NOTICE '';
  RAISE NOTICE 'Ready to build UI!';
  RAISE NOTICE '========================================';
END $$;
