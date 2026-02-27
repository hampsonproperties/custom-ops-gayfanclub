-- Create customer_notes table for customer-level notes
-- =================================================================
-- Similar to work_item_notes but for customers instead of projects

CREATE TABLE IF NOT EXISTS customer_notes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,

  -- Note content
  content TEXT NOT NULL,

  -- Flags
  starred BOOLEAN DEFAULT FALSE,
  is_internal BOOLEAN DEFAULT TRUE,

  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_by_user_id UUID REFERENCES users(id) ON DELETE SET NULL
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_customer_notes_customer ON customer_notes(customer_id);
CREATE INDEX IF NOT EXISTS idx_customer_notes_starred ON customer_notes(customer_id) WHERE starred = TRUE;
CREATE INDEX IF NOT EXISTS idx_customer_notes_created_at ON customer_notes(created_at DESC);

-- Update timestamp trigger
CREATE OR REPLACE FUNCTION update_customer_notes_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER customer_notes_updated_at
  BEFORE UPDATE ON customer_notes
  FOR EACH ROW
  EXECUTE FUNCTION update_customer_notes_updated_at();

-- Add helpful comment
COMMENT ON TABLE customer_notes IS 'Internal notes about customers (not project-specific)';
COMMENT ON COLUMN customer_notes.starred IS 'Whether this note is starred/favorited';
COMMENT ON COLUMN customer_notes.is_internal IS 'Internal notes vs notes shared with customer';
