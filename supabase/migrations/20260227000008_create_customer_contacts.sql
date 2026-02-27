-- Create customer_contacts table for alternative contacts
-- Supports sponsors, co-chairs, decision makers, financial contacts, etc.
-- =================================================================

CREATE TABLE IF NOT EXISTS customer_contacts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,

  -- Contact Info
  full_name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  role TEXT, -- 'Financial Sponsor', 'Co-Chair', 'Decision Maker', 'Coordinator', etc.
  title TEXT, -- Job title

  -- Flags
  is_primary BOOLEAN DEFAULT FALSE, -- Is this the main contact?
  receives_emails BOOLEAN DEFAULT TRUE, -- Should we CC them on emails?
  receives_invoices BOOLEAN DEFAULT FALSE, -- Send invoices to this contact?

  -- Metadata
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_by_user_id UUID REFERENCES users(id) ON DELETE SET NULL
);

-- Indexes
CREATE INDEX idx_customer_contacts_customer ON customer_contacts(customer_id);
CREATE INDEX idx_customer_contacts_email ON customer_contacts(email);
CREATE INDEX idx_customer_contacts_primary ON customer_contacts(customer_id) WHERE is_primary = TRUE;

-- Update timestamp trigger
CREATE OR REPLACE FUNCTION update_customer_contacts_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER customer_contacts_updated_at
  BEFORE UPDATE ON customer_contacts
  FOR EACH ROW
  EXECUTE FUNCTION update_customer_contacts_updated_at();

-- Add helpful comment
COMMENT ON TABLE customer_contacts IS 'Alternative contacts for customers - sponsors, co-chairs, decision makers, etc.';
COMMENT ON COLUMN customer_contacts.role IS 'Contact role: Financial Sponsor, Co-Chair, Decision Maker, Coordinator, etc.';
COMMENT ON COLUMN customer_contacts.receives_emails IS 'Whether to CC this contact on customer emails';
COMMENT ON COLUMN customer_contacts.receives_invoices IS 'Whether to send invoices to this contact';
