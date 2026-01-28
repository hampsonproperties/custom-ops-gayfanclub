-- Custom Ops Database Schema
-- Phase 1: Complete schema for The Gay Fan Club operations platform

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================================
-- ROLES TABLE
-- ============================================================================
CREATE TABLE roles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  key TEXT UNIQUE NOT NULL CHECK (key IN ('admin', 'ops', 'support')),
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- USERS TABLE
-- ============================================================================
CREATE TABLE users (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT UNIQUE NOT NULL,
  full_name TEXT,
  role_id UUID REFERENCES roles(id),
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- CUSTOMERS TABLE
-- ============================================================================
CREATE TABLE customers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email TEXT UNIQUE,
  first_name TEXT,
  last_name TEXT,
  display_name TEXT,
  phone TEXT,
  shopify_customer_id TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- WORK ITEMS TABLE (Core entity)
-- ============================================================================
CREATE TABLE work_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  type TEXT NOT NULL CHECK (type IN ('customify_order', 'assisted_project')),
  source TEXT NOT NULL CHECK (source IN ('shopify', 'email', 'form', 'manual')),
  title TEXT,

  -- Customer links
  customer_id UUID REFERENCES customers(id) ON DELETE SET NULL,
  customer_name TEXT,
  customer_email TEXT,

  -- Shopify links
  shopify_order_id TEXT,
  shopify_draft_order_id TEXT,
  shopify_order_number TEXT,
  shopify_financial_status TEXT,
  shopify_fulfillment_status TEXT,

  -- Operational details
  status TEXT NOT NULL,
  priority TEXT DEFAULT 'normal' CHECK (priority IN ('low', 'normal', 'high')),
  quantity INTEGER,
  grip_color TEXT,
  event_date DATE,
  due_date DATE,
  ship_by_date DATE,

  -- Design review fields (for customify orders)
  design_review_status TEXT DEFAULT 'pending' CHECK (design_review_status IN ('pending', 'approved', 'needs_fix')),
  design_preview_url TEXT,
  design_download_url TEXT,

  -- Follow-up fields
  last_contact_at TIMESTAMPTZ,
  next_follow_up_at TIMESTAMPTZ,
  follow_up_cadence_key TEXT,

  -- Assignment
  assigned_to_user_id UUID REFERENCES users(id) ON DELETE SET NULL,

  -- Batching
  ready_for_batch_at TIMESTAMPTZ,
  batched_at TIMESTAMPTZ,
  batch_id UUID, -- FK added later after batches table created

  -- Closeout
  closed_at TIMESTAMPTZ,
  close_reason TEXT,

  -- Diagnostics
  reason_included JSONB,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create index on status for fast queries
CREATE INDEX idx_work_items_status ON work_items(status);
CREATE INDEX idx_work_items_next_follow_up ON work_items(next_follow_up_at) WHERE closed_at IS NULL;
CREATE INDEX idx_work_items_type ON work_items(type);
CREATE INDEX idx_work_items_batch_id ON work_items(batch_id);

-- ============================================================================
-- WORK ITEM STATUS EVENTS TABLE (Audit trail)
-- ============================================================================
CREATE TABLE work_item_status_events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  work_item_id UUID NOT NULL REFERENCES work_items(id) ON DELETE CASCADE,
  from_status TEXT,
  to_status TEXT NOT NULL,
  changed_by_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  note TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_status_events_work_item ON work_item_status_events(work_item_id);

-- ============================================================================
-- COMMUNICATIONS TABLE (Email timeline)
-- ============================================================================
CREATE TABLE communications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  work_item_id UUID REFERENCES work_items(id) ON DELETE CASCADE,
  customer_id UUID REFERENCES customers(id) ON DELETE SET NULL,

  -- Provider identifiers
  provider TEXT DEFAULT 'm365' CHECK (provider IN ('m365')),
  provider_message_id TEXT,
  provider_thread_id TEXT,
  internet_message_id TEXT,

  -- Message details
  direction TEXT NOT NULL CHECK (direction IN ('inbound', 'outbound')),
  from_email TEXT NOT NULL,
  to_emails TEXT[] NOT NULL,
  cc_emails TEXT[],
  subject TEXT,
  body_preview TEXT,
  body_html TEXT,

  -- Attachments
  has_attachments BOOLEAN DEFAULT FALSE,
  attachments_meta JSONB,

  -- Triage status (for email intake queue)
  triage_status TEXT DEFAULT 'triaged' CHECK (triage_status IN ('untriaged', 'triaged', 'created_lead', 'attached', 'flagged_support', 'archived')),

  -- Timestamps
  sent_at TIMESTAMPTZ,
  received_at TIMESTAMPTZ,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_communications_work_item ON communications(work_item_id);
CREATE INDEX idx_communications_triage ON communications(triage_status) WHERE triage_status = 'untriaged';
CREATE INDEX idx_communications_thread ON communications(provider_thread_id);

-- ============================================================================
-- TEMPLATES TABLE (Email templates)
-- ============================================================================
CREATE TABLE templates (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  key TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  subject_template TEXT NOT NULL,
  body_html_template TEXT NOT NULL,
  merge_fields TEXT[],
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- FILES TABLE (Design assets)
-- ============================================================================
CREATE TABLE files (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  work_item_id UUID NOT NULL REFERENCES work_items(id) ON DELETE CASCADE,
  kind TEXT NOT NULL CHECK (kind IN ('preview', 'design', 'proof', 'other')),
  version INTEGER DEFAULT 1,
  original_filename TEXT NOT NULL,
  normalized_filename TEXT,
  storage_bucket TEXT NOT NULL,
  storage_path TEXT NOT NULL,
  mime_type TEXT,
  size_bytes BIGINT,
  uploaded_by_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  note TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_files_work_item ON files(work_item_id);

-- ============================================================================
-- BATCHES TABLE (Print batches)
-- ============================================================================
CREATE TABLE batches (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'confirmed', 'exported')),
  created_by_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  confirmed_at TIMESTAMPTZ,
  exported_at TIMESTAMPTZ,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- BATCH ITEMS TABLE (Join table)
-- ============================================================================
CREATE TABLE batch_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  batch_id UUID NOT NULL REFERENCES batches(id) ON DELETE CASCADE,
  work_item_id UUID NOT NULL REFERENCES work_items(id) ON DELETE CASCADE,
  position INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(batch_id, work_item_id)
);

CREATE INDEX idx_batch_items_batch ON batch_items(batch_id);
CREATE INDEX idx_batch_items_work_item ON batch_items(work_item_id);

-- Add FK constraint to work_items.batch_id now that batches table exists
ALTER TABLE work_items ADD CONSTRAINT fk_work_items_batch FOREIGN KEY (batch_id) REFERENCES batches(id) ON DELETE SET NULL;

-- ============================================================================
-- INTEGRATION ACCOUNTS TABLE (Shopify, M365)
-- ============================================================================
CREATE TABLE integration_accounts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  provider TEXT NOT NULL CHECK (provider IN ('shopify', 'm365')),
  display_name TEXT NOT NULL,
  status TEXT DEFAULT 'disconnected' CHECK (status IN ('connected', 'disconnected', 'error')),
  scopes TEXT[],
  settings JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- WEBHOOK EVENTS TABLE (Idempotency)
-- ============================================================================
CREATE TABLE webhook_events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  provider TEXT NOT NULL CHECK (provider IN ('shopify', 'm365')),
  event_type TEXT NOT NULL,
  external_event_id TEXT,
  payload JSONB NOT NULL,
  received_at TIMESTAMPTZ DEFAULT NOW(),
  processed_at TIMESTAMPTZ,
  processing_status TEXT DEFAULT 'received' CHECK (processing_status IN ('received', 'processed', 'failed')),
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE UNIQUE INDEX idx_webhook_events_external_id ON webhook_events(external_event_id) WHERE external_event_id IS NOT NULL;
CREATE INDEX idx_webhook_events_status ON webhook_events(processing_status);

-- ============================================================================
-- SETTINGS TABLE (System configuration)
-- ============================================================================
CREATE TABLE settings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  key TEXT UNIQUE NOT NULL,
  value JSONB NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- UPDATED_AT TRIGGER FUNCTION
-- ============================================================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply updated_at triggers to all tables
CREATE TRIGGER update_roles_updated_at BEFORE UPDATE ON roles FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_customers_updated_at BEFORE UPDATE ON customers FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_work_items_updated_at BEFORE UPDATE ON work_items FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_work_item_status_events_updated_at BEFORE UPDATE ON work_item_status_events FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_communications_updated_at BEFORE UPDATE ON communications FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_templates_updated_at BEFORE UPDATE ON templates FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_files_updated_at BEFORE UPDATE ON files FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_batches_updated_at BEFORE UPDATE ON batches FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_batch_items_updated_at BEFORE UPDATE ON batch_items FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_integration_accounts_updated_at BEFORE UPDATE ON integration_accounts FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_webhook_events_updated_at BEFORE UPDATE ON webhook_events FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_settings_updated_at BEFORE UPDATE ON settings FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
