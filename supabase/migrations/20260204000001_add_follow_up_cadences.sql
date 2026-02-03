-- Create follow_up_cadences table for managing automated follow-up scheduling
CREATE TABLE IF NOT EXISTS follow_up_cadences (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  cadence_key TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  work_item_type TEXT NOT NULL CHECK (work_item_type IN ('customify_order', 'assisted_project')),
  status TEXT NOT NULL,
  days_until_event_min INTEGER,
  days_until_event_max INTEGER,
  follow_up_days INTEGER NOT NULL CHECK (follow_up_days > 0),
  business_days_only BOOLEAN DEFAULT false,
  priority INTEGER DEFAULT 100,
  is_active BOOLEAN DEFAULT true,
  pauses_follow_up BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT valid_range CHECK (
    (days_until_event_min IS NULL) OR
    (days_until_event_max IS NULL) OR
    (days_until_event_min <= days_until_event_max)
  )
);

-- Create index for fast lookups by type and status
CREATE INDEX idx_cadences_type_status ON follow_up_cadences(work_item_type, status, is_active);

-- Create index for cadence key lookups
CREATE INDEX idx_cadences_key ON follow_up_cadences(cadence_key);

-- Add updated_at trigger
CREATE TRIGGER set_updated_at
  BEFORE UPDATE ON follow_up_cadences
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Add RLS policies
ALTER TABLE follow_up_cadences ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users to read cadences
CREATE POLICY "Authenticated users can read follow_up_cadences"
  ON follow_up_cadences
  FOR SELECT
  TO authenticated
  USING (true);

-- Allow authenticated users to insert/update/delete cadences (admin only in future)
CREATE POLICY "Authenticated users can manage follow_up_cadences"
  ON follow_up_cadences
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);
