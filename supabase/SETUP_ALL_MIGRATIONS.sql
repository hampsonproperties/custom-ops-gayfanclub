-- ============================================================================
-- CUSTOM OPS - COMPLETE DATABASE SETUP
-- Run this entire file in Supabase SQL Editor
-- ============================================================================

-- MIGRATION 1: Initial Schema
-- ============================================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ROLES TABLE
CREATE TABLE roles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  key TEXT UNIQUE NOT NULL CHECK (key IN ('admin', 'ops', 'support')),
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- USERS TABLE
CREATE TABLE users (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT UNIQUE NOT NULL,
  full_name TEXT,
  role_id UUID REFERENCES roles(id),
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- CUSTOMERS TABLE
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

-- WORK ITEMS TABLE (Core entity)
CREATE TABLE work_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  type TEXT NOT NULL CHECK (type IN ('customify_order', 'assisted_project')),
  source TEXT NOT NULL CHECK (source IN ('shopify', 'email', 'form', 'manual')),
  title TEXT,
  customer_id UUID REFERENCES customers(id) ON DELETE SET NULL,
  customer_name TEXT,
  customer_email TEXT,
  shopify_order_id TEXT,
  shopify_draft_order_id TEXT,
  shopify_order_number TEXT,
  shopify_financial_status TEXT,
  shopify_fulfillment_status TEXT,
  status TEXT NOT NULL,
  priority TEXT DEFAULT 'normal' CHECK (priority IN ('low', 'normal', 'high')),
  quantity INTEGER,
  grip_color TEXT,
  event_date DATE,
  due_date DATE,
  ship_by_date DATE,
  design_review_status TEXT DEFAULT 'pending' CHECK (design_review_status IN ('pending', 'approved', 'needs_fix')),
  design_preview_url TEXT,
  design_download_url TEXT,
  last_contact_at TIMESTAMPTZ,
  next_follow_up_at TIMESTAMPTZ,
  follow_up_cadence_key TEXT,
  assigned_to_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  ready_for_batch_at TIMESTAMPTZ,
  batched_at TIMESTAMPTZ,
  batch_id UUID,
  closed_at TIMESTAMPTZ,
  close_reason TEXT,
  reason_included JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_work_items_status ON work_items(status);
CREATE INDEX idx_work_items_next_follow_up ON work_items(next_follow_up_at) WHERE closed_at IS NULL;
CREATE INDEX idx_work_items_type ON work_items(type);
CREATE INDEX idx_work_items_batch_id ON work_items(batch_id);

-- WORK ITEM STATUS EVENTS TABLE
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

-- COMMUNICATIONS TABLE
CREATE TABLE communications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  work_item_id UUID REFERENCES work_items(id) ON DELETE CASCADE,
  customer_id UUID REFERENCES customers(id) ON DELETE SET NULL,
  provider TEXT DEFAULT 'm365' CHECK (provider IN ('m365')),
  provider_message_id TEXT,
  provider_thread_id TEXT,
  internet_message_id TEXT,
  direction TEXT NOT NULL CHECK (direction IN ('inbound', 'outbound')),
  from_email TEXT NOT NULL,
  to_emails TEXT[] NOT NULL,
  cc_emails TEXT[],
  subject TEXT,
  body_preview TEXT,
  body_html TEXT,
  has_attachments BOOLEAN DEFAULT FALSE,
  attachments_meta JSONB,
  triage_status TEXT DEFAULT 'triaged' CHECK (triage_status IN ('untriaged', 'triaged', 'created_lead', 'attached', 'flagged_support', 'archived')),
  sent_at TIMESTAMPTZ,
  received_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_communications_work_item ON communications(work_item_id);
CREATE INDEX idx_communications_triage ON communications(triage_status) WHERE triage_status = 'untriaged';
CREATE INDEX idx_communications_thread ON communications(provider_thread_id);

-- TEMPLATES TABLE
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

-- FILES TABLE
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

-- BATCHES TABLE
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

-- BATCH ITEMS TABLE
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

ALTER TABLE work_items ADD CONSTRAINT fk_work_items_batch FOREIGN KEY (batch_id) REFERENCES batches(id) ON DELETE SET NULL;

-- INTEGRATION ACCOUNTS TABLE
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

-- WEBHOOK EVENTS TABLE
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

-- SETTINGS TABLE
CREATE TABLE settings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  key TEXT UNIQUE NOT NULL,
  value JSONB NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- UPDATED_AT TRIGGER FUNCTION
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

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


-- ============================================================================
-- MIGRATION 2: Seed Data
-- ============================================================================

-- Insert Roles
INSERT INTO roles (key, name) VALUES
  ('admin', 'Administrator'),
  ('ops', 'Operations / Fulfillment'),
  ('support', 'Sales / Support')
ON CONFLICT (key) DO NOTHING;

-- Insert Email Templates
INSERT INTO templates (key, name, subject_template, body_html_template, merge_fields, is_active) VALUES

('design_fix_request', 'Design Fix Request',
'Your custom fan design needs a small adjustment',
'<p>Hi {{customer_name}},</p>

<p>Thanks so much for your custom fan order! We''ve reviewed your design and need a quick adjustment to ensure it prints beautifully.</p>

<p><strong>What we need:</strong><br>
{{fix_notes}}</p>

<p>Please reply to this email with your updated design file, or if you have questions, just let us know!</p>

<p><strong>Order Details:</strong></p>
<ul>
  <li>Order Number: {{order_number}}</li>
  <li>Quantity: {{quantity}}</li>
  <li>Grip Color: {{grip_color}}</li>
</ul>

<p>We''ll review it as soon as you send it over and get your fans into production!</p>

<p>Thanks,<br>
The Gay Fan Club Team 🌈</p>',
ARRAY['customer_name', 'fix_notes', 'order_number', 'quantity', 'grip_color'],
true),

('new_inquiry_response', 'New Custom Inquiry Response',
'Custom fans for {{event_name}}',
'<p>Hi {{customer_name}}!</p>

<p>Thanks for reaching out about custom fans! We''d love to help make your {{event_type}} extra special.</p>

<p>Here''s what we need to get started:</p>
<ul>
  <li>How many fans do you need?</li>
  <li>What''s your event date?</li>
  <li>Do you have design ideas or artwork already?</li>
  <li>What grip color would you like? (Natural, White, Black, or Custom)</li>
</ul>

<p>Once we have these details, we can send you a quote and timeline!</p>

<p>Looking forward to working with you!</p>

<p>Best,<br>
The Gay Fan Club Team 🌈</p>',
ARRAY['customer_name', 'event_name', 'event_type'],
true);

-- Insert System Settings
INSERT INTO settings (key, value, description) VALUES

('custom_detection_rules',
'{
  "line_item_properties": ["customify", "design_preview", "design_download"],
  "product_keywords": ["Custom", "Custom Fan", "Customify"],
  "sku_patterns": ["CUSTOM-", "CF-"],
  "order_tags": ["custom", "customify"],
  "draft_order_titles": ["CUSTOM FAN PROJECT", "CUSTOM FAN (BULK ORDER)"]
}'::jsonb,
'Rules for detecting custom orders from Shopify'),

('sla_thresholds',
'{
  "design_review_initial": 8,
  "design_review_resubmit": 8,
  "lead_response_initial": 8,
  "lead_response_active": 16,
  "batch_readiness": 16
}'::jsonb,
'SLA thresholds in business hours'),

('cadence_rules',
'{
  "new_inquiry": 1,
  "info_sent": 3,
  "design_fee_sent": 5,
  "proof_sent": 2,
  "invoice_sent": 3,
  "future_event_120_plus": 30,
  "future_event_60_120": 14,
  "future_event_30_60": 7,
  "future_event_under_30": 3
}'::jsonb,
'Follow-up cadence rules by status'),

('business_days',
'{
  "timezone": "America/Los_Angeles",
  "working_days": [1, 2, 3, 4, 5],
  "holidays": []
}'::jsonb,
'Business days configuration');


-- ============================================================================
-- MIGRATION 3: RLS Policies
-- ============================================================================

-- Enable RLS on all tables
ALTER TABLE roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE work_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE work_item_status_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE communications ENABLE ROW LEVEL SECURITY;
ALTER TABLE templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE files ENABLE ROW LEVEL SECURITY;
ALTER TABLE batches ENABLE ROW LEVEL SECURITY;
ALTER TABLE batch_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE integration_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE webhook_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE settings ENABLE ROW LEVEL SECURITY;

-- Helper function
CREATE OR REPLACE FUNCTION get_user_role()
RETURNS TEXT AS $$
  SELECT r.key
  FROM users u
  JOIN roles r ON u.role_id = r.id
  WHERE u.id = auth.uid();
$$ LANGUAGE SQL SECURITY DEFINER;

-- ROLES policies
CREATE POLICY "Admins can view roles" ON roles FOR SELECT USING (get_user_role() = 'admin');
CREATE POLICY "Admins can manage roles" ON roles FOR ALL USING (get_user_role() = 'admin');

-- USERS policies
CREATE POLICY "Authenticated users can view users" ON users FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Users can update their own profile" ON users FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "Admins can manage users" ON users FOR ALL USING (get_user_role() = 'admin');

-- CUSTOMERS policies
CREATE POLICY "Authenticated users can view customers" ON customers FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Authenticated users can create customers" ON customers FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Authenticated users can update customers" ON customers FOR UPDATE USING (auth.role() = 'authenticated');

-- WORK ITEMS policies
CREATE POLICY "Authenticated users can view work items" ON work_items FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Authenticated users can create work items" ON work_items FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Authenticated users can update work items" ON work_items FOR UPDATE USING (auth.role() = 'authenticated');
CREATE POLICY "Admins can delete work items" ON work_items FOR DELETE USING (get_user_role() = 'admin');

-- STATUS EVENTS policies
CREATE POLICY "Authenticated users can view status events" ON work_item_status_events FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Authenticated users can create status events" ON work_item_status_events FOR INSERT WITH CHECK (auth.role() = 'authenticated');

-- COMMUNICATIONS policies
CREATE POLICY "Authenticated users can view communications" ON communications FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Authenticated users can create communications" ON communications FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Authenticated users can update communications" ON communications FOR UPDATE USING (auth.role() = 'authenticated');

-- TEMPLATES policies
CREATE POLICY "Authenticated users can view templates" ON templates FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Admins can manage templates" ON templates FOR ALL USING (get_user_role() = 'admin');

-- FILES policies
CREATE POLICY "Authenticated users can view files" ON files FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Authenticated users can upload files" ON files FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Authenticated users can update files" ON files FOR UPDATE USING (auth.role() = 'authenticated');
CREATE POLICY "Admins can delete files" ON files FOR DELETE USING (get_user_role() = 'admin');

-- BATCHES policies
CREATE POLICY "Authenticated users can view batches" ON batches FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Ops and admins can create batches" ON batches FOR INSERT WITH CHECK (get_user_role() IN ('admin', 'ops'));
CREATE POLICY "Ops and admins can update batches" ON batches FOR UPDATE USING (get_user_role() IN ('admin', 'ops'));
CREATE POLICY "Admins can delete batches" ON batches FOR DELETE USING (get_user_role() = 'admin');

-- BATCH ITEMS policies
CREATE POLICY "Authenticated users can view batch items" ON batch_items FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Ops and admins can manage batch items" ON batch_items FOR ALL USING (get_user_role() IN ('admin', 'ops'));

-- INTEGRATION ACCOUNTS policies
CREATE POLICY "Admins can manage integration accounts" ON integration_accounts FOR ALL USING (get_user_role() = 'admin');

-- WEBHOOK EVENTS policies
CREATE POLICY "Service role can create webhook events" ON webhook_events FOR INSERT WITH CHECK (auth.role() = 'service_role' OR get_user_role() = 'admin');
CREATE POLICY "Admins can view webhook events" ON webhook_events FOR SELECT USING (get_user_role() = 'admin');
CREATE POLICY "Service role can update webhook events" ON webhook_events FOR UPDATE USING (auth.role() = 'service_role' OR get_user_role() = 'admin');

-- SETTINGS policies
CREATE POLICY "Authenticated users can view settings" ON settings FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Admins can manage settings" ON settings FOR ALL USING (get_user_role() = 'admin');
