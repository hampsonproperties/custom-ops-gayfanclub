-- ============================================================================
-- Migration: Create Auto-Reminder Engine
-- ============================================================================

CREATE TABLE reminder_templates (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  key TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  trigger_type TEXT NOT NULL CHECK (trigger_type IN ('approval_expiring', 'payment_overdue', 'files_not_received', 'design_review_pending', 'follow_up_overdue', 'stale_item')),
  trigger_days INTEGER NOT NULL,
  subject_template TEXT NOT NULL,
  body_html_template TEXT NOT NULL,
  merge_fields TEXT[],
  is_active BOOLEAN DEFAULT TRUE,
  send_to_customer BOOLEAN DEFAULT TRUE,
  send_to_operator BOOLEAN DEFAULT FALSE,
  operator_email TEXT,
  sent_count INTEGER DEFAULT 0,
  last_sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_reminder_templates_trigger ON reminder_templates(trigger_type);
CREATE INDEX idx_reminder_templates_active ON reminder_templates(is_active) WHERE is_active = TRUE;

CREATE TABLE reminder_queue (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  work_item_id UUID NOT NULL REFERENCES work_items(id) ON DELETE CASCADE,
  reminder_template_id UUID NOT NULL REFERENCES reminder_templates(id) ON DELETE CASCADE,
  scheduled_for TIMESTAMPTZ NOT NULL,
  sent_at TIMESTAMPTZ,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'failed', 'cancelled')),
  error_message TEXT,
  retry_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_reminder_queue_scheduled ON reminder_queue(scheduled_for) WHERE status = 'pending';
CREATE INDEX idx_reminder_queue_work_item ON reminder_queue(work_item_id);
CREATE INDEX idx_reminder_queue_status ON reminder_queue(status);

INSERT INTO reminder_templates (key, name, description, trigger_type, trigger_days, subject_template, body_html_template, merge_fields, send_to_customer, send_to_operator) VALUES ('approval_expiring_2d', 'Approval Expiring in 2 Days', 'Remind customer their approval link expires in 2 days', 'approval_expiring', 2, 'Reminder: Your design approval for {{work_item_title}} expires in 2 days', '<p>Hi {{customer_name}},</p><p>This is a friendly reminder that your design approval link will expire in <strong>2 days</strong>.</p><p>Please review and approve your design as soon as possible to keep your order on schedule.</p><p><strong>Order:</strong> {{work_item_title}}</p><p>If you need a new approval link, just reply to this email.</p><p>Thank you!</p><p>The Gay Fan Club Team</p>', ARRAY['customer_name', 'work_item_title', 'approval_url', 'event_date'], TRUE, FALSE);

INSERT INTO reminder_templates (key, name, description, trigger_type, trigger_days, subject_template, body_html_template, merge_fields, send_to_customer, send_to_operator) VALUES ('payment_overdue_7d', 'Payment Overdue - 7 Days', 'Remind customer their balance payment is overdue', 'payment_overdue', 7, 'Payment Reminder: Balance due for {{work_item_title}}', '<p>Hi {{customer_name}},</p><p>We noticed the balance payment for your order is now overdue.</p><p><strong>Order:</strong> {{work_item_title}}<br><strong>Amount Due:</strong> {{balance_amount}}</p><p>To keep your order on schedule, please submit your payment as soon as possible.</p><p>If you have any questions about payment, please reply to this email or give us a call.</p><p>Thank you!</p><p>The Gay Fan Club Team</p>', ARRAY['customer_name', 'work_item_title', 'balance_amount', 'payment_url'], TRUE, TRUE);

INSERT INTO reminder_templates (key, name, description, trigger_type, trigger_days, subject_template, body_html_template, merge_fields, send_to_customer, send_to_operator) VALUES ('files_not_received_7d', 'Files Not Received - 7 Days', 'Remind customer to send their artwork/files', 'files_not_received', 7, 'Reminder: We are waiting for your files for {{work_item_title}}', '<p>Hi {{customer_name}},</p><p>We are still waiting to receive your artwork files for:</p><p><strong>Order:</strong> {{work_item_title}}</p><p>To keep your order on schedule, please upload your files as soon as possible.</p><p>If you need help with file formats or have any questions, just reply to this email.</p><p>Thank you!</p><p>The Gay Fan Club Team</p>', ARRAY['customer_name', 'work_item_title', 'upload_url'], TRUE, FALSE);

INSERT INTO reminder_templates (key, name, description, trigger_type, trigger_days, subject_template, body_html_template, merge_fields, send_to_customer, send_to_operator) VALUES ('design_review_pending_3d', 'Design Review Pending - Internal Alert', 'Alert operator that design needs review', 'design_review_pending', 3, '[INTERNAL] Design Review Needed: {{work_item_title}}', '<p>A design has been pending review for 3 days:</p><p><strong>Order:</strong> {{work_item_title}}<br><strong>Customer:</strong> {{customer_name}}</p><p>Please review the design to keep the order on schedule.</p>', ARRAY['work_item_title', 'customer_name', 'work_item_url'], FALSE, TRUE);

CREATE OR REPLACE FUNCTION generate_reminders() RETURNS TABLE (work_item_id UUID, template_key TEXT, scheduled_for TIMESTAMPTZ) LANGUAGE plpgsql AS $$ BEGIN RETURN QUERY INSERT INTO reminder_queue (work_item_id, reminder_template_id, scheduled_for) SELECT wi.id, rt.id, wi.last_contact_at + INTERVAL '12 days' FROM work_items wi CROSS JOIN reminder_templates rt WHERE wi.status = 'awaiting_approval' AND wi.closed_at IS NULL AND rt.trigger_type = 'approval_expiring' AND rt.is_active = TRUE AND wi.last_contact_at IS NOT NULL AND wi.last_contact_at + INTERVAL '12 days' <= NOW() + INTERVAL '1 day' AND wi.last_contact_at + INTERVAL '12 days' >= NOW() AND NOT EXISTS (SELECT 1 FROM reminder_queue rq WHERE rq.work_item_id = wi.id AND rq.reminder_template_id = rt.id AND rq.scheduled_for::date = (wi.last_contact_at + INTERVAL '12 days')::date) RETURNING reminder_queue.work_item_id, rt.key, reminder_queue.scheduled_for; RETURN QUERY INSERT INTO reminder_queue (work_item_id, reminder_template_id, scheduled_for) SELECT wi.id, rt.id, wi.created_at + (rt.trigger_days || ' days')::INTERVAL FROM work_items wi CROSS JOIN reminder_templates rt WHERE wi.status IN ('deposit_paid', 'awaiting_balance') AND wi.closed_at IS NULL AND wi.shopify_financial_status != 'paid' AND rt.trigger_type = 'payment_overdue' AND rt.is_active = TRUE AND wi.created_at + (rt.trigger_days || ' days')::INTERVAL <= NOW() + INTERVAL '1 day' AND wi.created_at + (rt.trigger_days || ' days')::INTERVAL >= NOW() AND NOT EXISTS (SELECT 1 FROM reminder_queue rq WHERE rq.work_item_id = wi.id AND rq.reminder_template_id = rt.id AND rq.status IN ('pending', 'sent') AND rq.created_at > NOW() - INTERVAL '7 days') RETURNING reminder_queue.work_item_id, rt.key, reminder_queue.scheduled_for; RETURN QUERY INSERT INTO reminder_queue (work_item_id, reminder_template_id, scheduled_for) SELECT wi.id, rt.id, COALESCE(wi.last_contact_at, wi.created_at) + (rt.trigger_days || ' days')::INTERVAL FROM work_items wi CROSS JOIN reminder_templates rt WHERE wi.status IN ('awaiting_files', 'customer_providing_artwork') AND wi.closed_at IS NULL AND rt.trigger_type = 'files_not_received' AND rt.is_active = TRUE AND COALESCE(wi.last_contact_at, wi.created_at) + (rt.trigger_days || ' days')::INTERVAL <= NOW() + INTERVAL '1 day' AND COALESCE(wi.last_contact_at, wi.created_at) + (rt.trigger_days || ' days')::INTERVAL >= NOW() AND NOT EXISTS (SELECT 1 FROM reminder_queue rq WHERE rq.work_item_id = wi.id AND rq.reminder_template_id = rt.id AND rq.status IN ('pending', 'sent') AND rq.created_at > NOW() - INTERVAL '7 days') RETURNING reminder_queue.work_item_id, rt.key, reminder_queue.scheduled_for; RETURN QUERY INSERT INTO reminder_queue (work_item_id, reminder_template_id, scheduled_for) SELECT wi.id, rt.id, wi.updated_at + (rt.trigger_days || ' days')::INTERVAL FROM work_items wi CROSS JOIN reminder_templates rt WHERE wi.status = 'design_received' AND wi.design_review_status = 'pending' AND wi.closed_at IS NULL AND rt.trigger_type = 'design_review_pending' AND rt.is_active = TRUE AND wi.updated_at + (rt.trigger_days || ' days')::INTERVAL <= NOW() + INTERVAL '1 day' AND wi.updated_at + (rt.trigger_days || ' days')::INTERVAL >= NOW() AND NOT EXISTS (SELECT 1 FROM reminder_queue rq WHERE rq.work_item_id = wi.id AND rq.reminder_template_id = rt.id AND rq.status IN ('pending', 'sent') AND rq.created_at > NOW() - INTERVAL '3 days') RETURNING reminder_queue.work_item_id, rt.key, reminder_queue.scheduled_for; END; $$;

CREATE OR REPLACE FUNCTION get_pending_reminders(p_limit INTEGER DEFAULT 10) RETURNS TABLE (reminder_id UUID, work_item_id UUID, template_key TEXT, customer_email TEXT, customer_name TEXT, work_item_title TEXT, subject TEXT, body_html TEXT, send_to_customer BOOLEAN, send_to_operator BOOLEAN, operator_email TEXT) LANGUAGE plpgsql AS $$ BEGIN RETURN QUERY SELECT rq.id, rq.work_item_id, rt.key, c.email, COALESCE(c.display_name, c.email), wi.title, rt.subject_template, rt.body_html_template, rt.send_to_customer, rt.send_to_operator, rt.operator_email FROM reminder_queue rq INNER JOIN reminder_templates rt ON rq.reminder_template_id = rt.id INNER JOIN work_items wi ON rq.work_item_id = wi.id LEFT JOIN customers c ON wi.customer_id = c.id WHERE rq.status = 'pending' AND rq.scheduled_for <= NOW() ORDER BY rq.scheduled_for LIMIT p_limit; END; $$;

CREATE OR REPLACE VIEW reminder_stats AS SELECT rt.key as template_key, rt.name as template_name, rt.trigger_type, COUNT(rq.id) FILTER (WHERE rq.status = 'pending') as pending_count, COUNT(rq.id) FILTER (WHERE rq.status = 'sent') as sent_count, COUNT(rq.id) FILTER (WHERE rq.status = 'failed') as failed_count, MAX(rq.sent_at) as last_sent_at, rt.is_active FROM reminder_templates rt LEFT JOIN reminder_queue rq ON rt.id = rq.reminder_template_id GROUP BY rt.id, rt.key, rt.name, rt.trigger_type, rt.is_active ORDER BY rt.trigger_type, rt.key;

CREATE TRIGGER update_reminder_templates_updated_at BEFORE UPDATE ON reminder_templates FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_reminder_queue_updated_at BEFORE UPDATE ON reminder_queue FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
