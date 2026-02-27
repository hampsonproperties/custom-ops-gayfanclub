-- Add customer_notes table for simple internal notes (without @mentions for now)
-- Part of PDR v3 Customer Profile implementation

-- Create customer_notes table
CREATE TABLE IF NOT EXISTS customer_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Links
  customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  created_by_user_id UUID REFERENCES users(id) ON DELETE SET NULL,

  -- Content
  note TEXT NOT NULL,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_customer_notes_customer ON customer_notes(customer_id);
CREATE INDEX IF NOT EXISTS idx_customer_notes_created_by ON customer_notes(created_by_user_id);
CREATE INDEX IF NOT EXISTS idx_customer_notes_created_at ON customer_notes(created_at DESC);

-- Enable RLS
ALTER TABLE customer_notes ENABLE ROW LEVEL SECURITY;

-- RLS Policies
-- Allow authenticated users to read all customer notes
CREATE POLICY "Users can view customer notes"
  ON customer_notes
  FOR SELECT
  TO authenticated
  USING (true);

-- Allow authenticated users to insert customer notes
CREATE POLICY "Users can create customer notes"
  ON customer_notes
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Allow users to update their own notes
CREATE POLICY "Users can update own customer notes"
  ON customer_notes
  FOR UPDATE
  TO authenticated
  USING (created_by_user_id = auth.uid());

-- Allow users to delete their own notes
CREATE POLICY "Users can delete own customer notes"
  ON customer_notes
  FOR DELETE
  TO authenticated
  USING (created_by_user_id = auth.uid());

-- Add updated_at trigger
CREATE OR REPLACE FUNCTION update_customer_notes_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_customer_notes_updated_at_trigger
  BEFORE UPDATE ON customer_notes
  FOR EACH ROW
  EXECUTE FUNCTION update_customer_notes_updated_at();

-- Add comment
COMMENT ON TABLE customer_notes IS 'Internal notes about customers for team collaboration (PDR v3)';
