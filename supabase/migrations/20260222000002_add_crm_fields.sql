-- Add comprehensive CRM fields to work_items table
-- This migration adds missing contact and company information fields

ALTER TABLE work_items
ADD COLUMN IF NOT EXISTS company_name TEXT,
ADD COLUMN IF NOT EXISTS phone_number TEXT,
ADD COLUMN IF NOT EXISTS secondary_contacts JSONB DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS address TEXT,
ADD COLUMN IF NOT EXISTS website TEXT,
ADD COLUMN IF NOT EXISTS lead_source TEXT,
ADD COLUMN IF NOT EXISTS industry TEXT,
ADD COLUMN IF NOT EXISTS company_size TEXT;

-- Create index on company_name for searching
CREATE INDEX IF NOT EXISTS idx_work_items_company_name ON work_items(company_name);

-- Create index on phone_number for searching
CREATE INDEX IF NOT EXISTS idx_work_items_phone_number ON work_items(phone_number);

-- Comment the new fields
COMMENT ON COLUMN work_items.company_name IS 'Company/organization name (separate from contact name)';
COMMENT ON COLUMN work_items.phone_number IS 'Primary phone number for contact';
COMMENT ON COLUMN work_items.secondary_contacts IS 'Array of additional contacts: [{name, email, phone, role}]';
COMMENT ON COLUMN work_items.address IS 'Physical address or mailing address';
COMMENT ON COLUMN work_items.website IS 'Company website URL';
COMMENT ON COLUMN work_items.lead_source IS 'How they found us (referral, social, ad, etc)';
COMMENT ON COLUMN work_items.industry IS 'Industry or vertical (retail, tech, nonprofit, etc)';
COMMENT ON COLUMN work_items.company_size IS 'Company size (1-10, 11-50, 51-200, 201+, etc)';
