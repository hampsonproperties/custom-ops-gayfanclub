-- Row Level Security Policies
-- Phase 1: Permissive policies for MVP, to be tightened later

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

-- ============================================================================
-- HELPER FUNCTION: Get current user's role
-- ============================================================================
CREATE OR REPLACE FUNCTION get_user_role()
RETURNS TEXT AS $$
  SELECT r.key
  FROM users u
  JOIN roles r ON u.role_id = r.id
  WHERE u.id = auth.uid();
$$ LANGUAGE SQL SECURITY DEFINER;

-- ============================================================================
-- ROLES - Admin only
-- ============================================================================
CREATE POLICY "Admins can view roles" ON roles
  FOR SELECT
  USING (get_user_role() = 'admin');

CREATE POLICY "Admins can manage roles" ON roles
  FOR ALL
  USING (get_user_role() = 'admin');

-- ============================================================================
-- USERS - All authenticated users can view, admins can manage
-- ============================================================================
CREATE POLICY "Authenticated users can view users" ON users
  FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "Users can update their own profile" ON users
  FOR UPDATE
  USING (auth.uid() = id);

CREATE POLICY "Admins can manage users" ON users
  FOR ALL
  USING (get_user_role() = 'admin');

-- ============================================================================
-- CUSTOMERS - All authenticated users can access
-- ============================================================================
CREATE POLICY "Authenticated users can view customers" ON customers
  FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can create customers" ON customers
  FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can update customers" ON customers
  FOR UPDATE
  USING (auth.role() = 'authenticated');

-- ============================================================================
-- WORK ITEMS - All authenticated users can access
-- ============================================================================
CREATE POLICY "Authenticated users can view work items" ON work_items
  FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can create work items" ON work_items
  FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can update work items" ON work_items
  FOR UPDATE
  USING (auth.role() = 'authenticated');

CREATE POLICY "Admins can delete work items" ON work_items
  FOR DELETE
  USING (get_user_role() = 'admin');

-- ============================================================================
-- WORK ITEM STATUS EVENTS - Read-only audit log
-- ============================================================================
CREATE POLICY "Authenticated users can view status events" ON work_item_status_events
  FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can create status events" ON work_item_status_events
  FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');

-- ============================================================================
-- COMMUNICATIONS - All authenticated users can access
-- ============================================================================
CREATE POLICY "Authenticated users can view communications" ON communications
  FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can create communications" ON communications
  FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can update communications" ON communications
  FOR UPDATE
  USING (auth.role() = 'authenticated');

-- ============================================================================
-- TEMPLATES - All can read, admins can manage
-- ============================================================================
CREATE POLICY "Authenticated users can view templates" ON templates
  FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "Admins can manage templates" ON templates
  FOR ALL
  USING (get_user_role() = 'admin');

-- ============================================================================
-- FILES - All authenticated users can access
-- ============================================================================
CREATE POLICY "Authenticated users can view files" ON files
  FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can upload files" ON files
  FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can update files" ON files
  FOR UPDATE
  USING (auth.role() = 'authenticated');

CREATE POLICY "Admins can delete files" ON files
  FOR DELETE
  USING (get_user_role() = 'admin');

-- ============================================================================
-- BATCHES - All authenticated users can access
-- ============================================================================
CREATE POLICY "Authenticated users can view batches" ON batches
  FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "Ops and admins can create batches" ON batches
  FOR INSERT
  WITH CHECK (get_user_role() IN ('admin', 'ops'));

CREATE POLICY "Ops and admins can update batches" ON batches
  FOR UPDATE
  USING (get_user_role() IN ('admin', 'ops'));

CREATE POLICY "Admins can delete batches" ON batches
  FOR DELETE
  USING (get_user_role() = 'admin');

-- ============================================================================
-- BATCH ITEMS - All authenticated users can access
-- ============================================================================
CREATE POLICY "Authenticated users can view batch items" ON batch_items
  FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "Ops and admins can manage batch items" ON batch_items
  FOR ALL
  USING (get_user_role() IN ('admin', 'ops'));

-- ============================================================================
-- INTEGRATION ACCOUNTS - Admins only
-- ============================================================================
CREATE POLICY "Admins can manage integration accounts" ON integration_accounts
  FOR ALL
  USING (get_user_role() = 'admin');

-- ============================================================================
-- WEBHOOK EVENTS - System and admins only
-- ============================================================================
CREATE POLICY "Service role can create webhook events" ON webhook_events
  FOR INSERT
  WITH CHECK (auth.role() = 'service_role' OR get_user_role() = 'admin');

CREATE POLICY "Admins can view webhook events" ON webhook_events
  FOR SELECT
  USING (get_user_role() = 'admin');

CREATE POLICY "Service role can update webhook events" ON webhook_events
  FOR UPDATE
  USING (auth.role() = 'service_role' OR get_user_role() = 'admin');

-- ============================================================================
-- SETTINGS - All can read, admins can manage
-- ============================================================================
CREATE POLICY "Authenticated users can view settings" ON settings
  FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "Admins can manage settings" ON settings
  FOR ALL
  USING (get_user_role() = 'admin');
