-- Reference documents for AI suggested replies
-- Staff upload price sheets, FAQs, and policies that the AI uses as context

CREATE TABLE reference_docs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'general',
  original_filename TEXT NOT NULL,
  storage_path TEXT NOT NULL,
  mime_type TEXT,
  size_bytes BIGINT,
  content_text TEXT, -- extracted text from PDF/text files, used by AI at runtime
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  uploaded_by_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Category check
ALTER TABLE reference_docs ADD CONSTRAINT reference_docs_category_check
  CHECK (category IN ('pricing', 'policies', 'faqs', 'general'));

-- Updated_at trigger
CREATE TRIGGER set_reference_docs_updated_at
  BEFORE UPDATE ON reference_docs
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- RLS
ALTER TABLE reference_docs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read reference docs"
  ON reference_docs FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert reference docs"
  ON reference_docs FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update reference docs"
  ON reference_docs FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Admin users can delete reference docs"
  ON reference_docs FOR DELETE
  TO authenticated
  USING (get_user_role() IN ('admin', 'ops'));
