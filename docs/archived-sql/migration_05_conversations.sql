CREATE TABLE conversations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  customer_id UUID REFERENCES customers(id) ON DELETE SET NULL,
  work_item_id UUID REFERENCES work_items(id) ON DELETE SET NULL,
  provider TEXT DEFAULT 'm365' CHECK (provider IN ('m365', 'gmail', 'other')),
  provider_thread_id TEXT,
  subject TEXT NOT NULL,
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'resolved', 'archived')),
  message_count INTEGER DEFAULT 0,
  last_message_at TIMESTAMPTZ,
  last_message_from TEXT,
  last_message_direction TEXT CHECK (last_message_direction IN ('inbound', 'outbound')),
  has_unread BOOLEAN DEFAULT FALSE,
  is_important BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(provider, provider_thread_id)
);

CREATE INDEX idx_conversations_customer ON conversations(customer_id);
CREATE INDEX idx_conversations_work_item ON conversations(work_item_id);
CREATE INDEX idx_conversations_thread_id ON conversations(provider_thread_id) WHERE provider_thread_id IS NOT NULL;
CREATE INDEX idx_conversations_status ON conversations(status);
CREATE INDEX idx_conversations_last_message ON conversations(last_message_at DESC);
CREATE INDEX idx_conversations_unread ON conversations(has_unread) WHERE has_unread = TRUE;

ALTER TABLE communications ADD COLUMN conversation_id UUID REFERENCES conversations(id) ON DELETE SET NULL;

CREATE INDEX idx_communications_conversation ON communications(conversation_id);

CREATE OR REPLACE FUNCTION find_or_create_conversation(p_provider TEXT, p_provider_thread_id TEXT, p_subject TEXT, p_customer_id UUID DEFAULT NULL, p_work_item_id UUID DEFAULT NULL) RETURNS UUID LANGUAGE plpgsql AS $function$ DECLARE v_conversation_id UUID; BEGIN IF p_provider_thread_id IS NOT NULL THEN SELECT id INTO v_conversation_id FROM conversations WHERE provider = p_provider AND provider_thread_id = p_provider_thread_id; IF FOUND THEN RETURN v_conversation_id; END IF; END IF; INSERT INTO conversations (provider, provider_thread_id, subject, customer_id, work_item_id, status, message_count, last_message_at) VALUES (p_provider, p_provider_thread_id, p_subject, p_customer_id, p_work_item_id, 'active', 0, NOW()) RETURNING id INTO v_conversation_id; RETURN v_conversation_id; END; $function$;

CREATE OR REPLACE FUNCTION update_conversation_stats(p_conversation_id UUID, p_message_direction TEXT, p_message_from TEXT, p_received_at TIMESTAMPTZ) RETURNS VOID LANGUAGE plpgsql AS $function$ BEGIN UPDATE conversations SET message_count = message_count + 1, last_message_at = p_received_at, last_message_from = p_message_from, last_message_direction = p_message_direction, has_unread = CASE WHEN p_message_direction = 'inbound' THEN TRUE ELSE has_unread END, updated_at = NOW() WHERE id = p_conversation_id; END; $function$;

CREATE OR REPLACE FUNCTION trigger_update_conversation_stats() RETURNS TRIGGER LANGUAGE plpgsql AS $function$ BEGIN IF NEW.conversation_id IS NOT NULL THEN PERFORM update_conversation_stats(NEW.conversation_id, NEW.direction, NEW.from_email, NEW.received_at); END IF; RETURN NEW; END; $function$;

CREATE TRIGGER communications_update_conversation AFTER INSERT ON communications FOR EACH ROW EXECUTE FUNCTION trigger_update_conversation_stats();

DO $backfill$ DECLARE v_thread RECORD; v_conversation_id UUID; BEGIN FOR v_thread IN SELECT DISTINCT provider, provider_thread_id, subject, work_item_id, customer_id, MIN(received_at) as first_message_at FROM communications WHERE provider_thread_id IS NOT NULL GROUP BY provider, provider_thread_id, subject, work_item_id, customer_id LOOP INSERT INTO conversations (provider, provider_thread_id, subject, customer_id, work_item_id, status, message_count, last_message_at) VALUES (v_thread.provider, v_thread.provider_thread_id, v_thread.subject, v_thread.customer_id, v_thread.work_item_id, 'active', 0, v_thread.first_message_at) ON CONFLICT (provider, provider_thread_id) DO NOTHING RETURNING id INTO v_conversation_id; IF v_conversation_id IS NOT NULL THEN UPDATE communications SET conversation_id = v_conversation_id WHERE provider = v_thread.provider AND provider_thread_id = v_thread.provider_thread_id; END IF; END LOOP; UPDATE conversations c SET message_count = (SELECT COUNT(*) FROM communications WHERE conversation_id = c.id), last_message_at = (SELECT MAX(received_at) FROM communications WHERE conversation_id = c.id), last_message_from = (SELECT from_email FROM communications WHERE conversation_id = c.id ORDER BY received_at DESC LIMIT 1), last_message_direction = (SELECT direction FROM communications WHERE conversation_id = c.id ORDER BY received_at DESC LIMIT 1); END $backfill$;

CREATE OR REPLACE VIEW customer_conversations AS SELECT c.id as conversation_id, c.customer_id, cust.email as customer_email, cust.display_name as customer_name, c.work_item_id, wi.title as work_item_title, wi.status as work_item_status, c.subject, c.message_count, c.last_message_at, c.last_message_from, c.last_message_direction, c.has_unread, c.status as conversation_status, c.created_at FROM conversations c LEFT JOIN customers cust ON c.customer_id = cust.id LEFT JOIN work_items wi ON c.work_item_id = wi.id WHERE c.status = 'active' ORDER BY c.last_message_at DESC;

CREATE OR REPLACE VIEW unread_conversations AS SELECT c.id as conversation_id, c.customer_id, cust.display_name as customer_name, cust.email as customer_email, c.subject, c.message_count, c.last_message_at, EXTRACT(HOURS FROM (NOW() - c.last_message_at)) as hours_since_last_message FROM conversations c LEFT JOIN customers cust ON c.customer_id = cust.id WHERE c.has_unread = TRUE AND c.status = 'active' ORDER BY c.last_message_at DESC;

CREATE TRIGGER update_conversations_updated_at BEFORE UPDATE ON conversations FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
