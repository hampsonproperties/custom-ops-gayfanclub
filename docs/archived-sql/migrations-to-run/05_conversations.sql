-- ============================================================================
-- Migration: Create Conversations Table (CRM Model)
-- Purpose: Implement Customer → Projects → Conversations → Messages structure
-- Created: 2026-02-19
-- ============================================================================

-- 1. CREATE CONVERSATIONS TABLE
-- ============================================================================
CREATE TABLE conversations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

  -- Relationships
  customer_id UUID REFERENCES customers(id) ON DELETE SET NULL,
  work_item_id UUID REFERENCES work_items(id) ON DELETE SET NULL,

  -- Thread identification
  provider TEXT DEFAULT 'm365' CHECK (provider IN ('m365', 'gmail', 'other')),
  provider_thread_id TEXT, -- Microsoft Graph conversationId

  -- Conversation metadata
  subject TEXT NOT NULL,

  -- Status
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'resolved', 'archived')),

  -- Stats
  message_count INTEGER DEFAULT 0,
  last_message_at TIMESTAMPTZ,
  last_message_from TEXT, -- Email address of last sender
  last_message_direction TEXT CHECK (last_message_direction IN ('inbound', 'outbound')),

  -- Flags
  has_unread BOOLEAN DEFAULT FALSE,
  is_important BOOLEAN DEFAULT FALSE,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. CREATE INDEXES
-- ============================================================================
CREATE INDEX idx_conversations_customer ON conversations(customer_id);
CREATE INDEX idx_conversations_work_item ON conversations(work_item_id);
CREATE INDEX idx_conversations_thread_id ON conversations(provider_thread_id) WHERE provider_thread_id IS NOT NULL;
CREATE INDEX idx_conversations_status ON conversations(status);
CREATE INDEX idx_conversations_last_message ON conversations(last_message_at DESC);
CREATE INDEX idx_conversations_unread ON conversations(has_unread) WHERE has_unread = TRUE;

-- Unique constraint on provider_thread_id (one conversation per thread)
CREATE UNIQUE INDEX idx_conversations_unique_thread
ON conversations(provider, provider_thread_id)
WHERE provider_thread_id IS NOT NULL;

-- 3. ADD conversation_id TO communications TABLE
-- ============================================================================
ALTER TABLE communications
ADD COLUMN conversation_id UUID REFERENCES conversations(id) ON DELETE SET NULL;

CREATE INDEX idx_communications_conversation ON communications(conversation_id);

-- 4. CREATE FUNCTION TO FIND OR CREATE CONVERSATION
-- ============================================================================
CREATE OR REPLACE FUNCTION find_or_create_conversation(
  p_provider TEXT,
  p_provider_thread_id TEXT,
  p_subject TEXT,
  p_customer_id UUID DEFAULT NULL,
  p_work_item_id UUID DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
AS $$
DECLARE
  v_conversation_id UUID;
BEGIN
  -- Try to find existing conversation by thread ID
  IF p_provider_thread_id IS NOT NULL THEN
    SELECT id INTO v_conversation_id
    FROM conversations
    WHERE provider = p_provider
      AND provider_thread_id = p_provider_thread_id;

    IF FOUND THEN
      RETURN v_conversation_id;
    END IF;
  END IF;

  -- Create new conversation
  INSERT INTO conversations (
    provider,
    provider_thread_id,
    subject,
    customer_id,
    work_item_id,
    status,
    message_count,
    last_message_at
  ) VALUES (
    p_provider,
    p_provider_thread_id,
    p_subject,
    p_customer_id,
    p_work_item_id,
    'active',
    0,
    NOW()
  )
  RETURNING id INTO v_conversation_id;

  RETURN v_conversation_id;
END;
$$;

COMMENT ON FUNCTION find_or_create_conversation IS
'Finds existing conversation by thread ID or creates a new one.';

-- 5. CREATE FUNCTION TO UPDATE CONVERSATION STATS
-- ============================================================================
CREATE OR REPLACE FUNCTION update_conversation_stats(
  p_conversation_id UUID,
  p_message_direction TEXT,
  p_message_from TEXT,
  p_received_at TIMESTAMPTZ
)
RETURNS VOID
LANGUAGE plpgsql
AS $$
BEGIN
  UPDATE conversations
  SET
    message_count = message_count + 1,
    last_message_at = p_received_at,
    last_message_from = p_message_from,
    last_message_direction = p_message_direction,
    has_unread = CASE
      WHEN p_message_direction = 'inbound' THEN TRUE
      ELSE has_unread
    END,
    updated_at = NOW()
  WHERE id = p_conversation_id;
END;
$$;

COMMENT ON FUNCTION update_conversation_stats IS
'Updates conversation stats when a new message is added.';

-- 6. CREATE TRIGGER TO AUTO-UPDATE CONVERSATION STATS
-- ============================================================================
CREATE OR REPLACE FUNCTION trigger_update_conversation_stats()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  -- Only update if conversation_id is set
  IF NEW.conversation_id IS NOT NULL THEN
    PERFORM update_conversation_stats(
      NEW.conversation_id,
      NEW.direction,
      NEW.from_email,
      NEW.received_at
    );
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER communications_update_conversation
AFTER INSERT ON communications
FOR EACH ROW
EXECUTE FUNCTION trigger_update_conversation_stats();

-- 7. BACKFILL EXISTING COMMUNICATIONS INTO CONVERSATIONS
-- ============================================================================
-- Group existing communications by thread ID and create conversations
DO $$
DECLARE
  v_thread RECORD;
  v_conversation_id UUID;
  v_customer_id UUID;
  v_work_item_id UUID;
  v_thread_count INTEGER := 0;
BEGIN
  RAISE NOTICE 'Backfilling conversations from existing communications...';

  -- Process each unique thread
  FOR v_thread IN
    SELECT DISTINCT
      provider,
      provider_thread_id,
      subject,
      work_item_id,
      customer_id,
      MIN(received_at) as first_message_at,
      COUNT(*) as message_count
    FROM communications
    WHERE provider_thread_id IS NOT NULL
    GROUP BY provider, provider_thread_id, subject, work_item_id, customer_id
  LOOP
    -- Create conversation
    INSERT INTO conversations (
      provider,
      provider_thread_id,
      subject,
      customer_id,
      work_item_id,
      status,
      message_count,
      last_message_at
    )
    VALUES (
      v_thread.provider,
      v_thread.provider_thread_id,
      v_thread.subject,
      v_thread.customer_id,
      v_thread.work_item_id,
      'active',
      0, -- Will be updated by trigger
      v_thread.first_message_at
    )
    ON CONFLICT (provider, provider_thread_id) DO NOTHING
    RETURNING id INTO v_conversation_id;

    IF v_conversation_id IS NOT NULL THEN
      -- Link communications to this conversation
      UPDATE communications
      SET conversation_id = v_conversation_id
      WHERE provider = v_thread.provider
        AND provider_thread_id = v_thread.provider_thread_id;

      v_thread_count := v_thread_count + 1;
    END IF;
  END LOOP;

  RAISE NOTICE 'Backfilled % conversations', v_thread_count;

  -- Update conversation stats for all backfilled conversations
  UPDATE conversations c
  SET
    message_count = (
      SELECT COUNT(*)
      FROM communications
      WHERE conversation_id = c.id
    ),
    last_message_at = (
      SELECT MAX(received_at)
      FROM communications
      WHERE conversation_id = c.id
    ),
    last_message_from = (
      SELECT from_email
      FROM communications
      WHERE conversation_id = c.id
      ORDER BY received_at DESC
      LIMIT 1
    ),
    last_message_direction = (
      SELECT direction
      FROM communications
      WHERE conversation_id = c.id
      ORDER BY received_at DESC
      LIMIT 1
    );

  RAISE NOTICE 'Updated stats for all conversations';
END $$;

-- 8. CREATE CONVERSATION VIEWS
-- ============================================================================

-- Active conversations by customer
CREATE OR REPLACE VIEW customer_conversations AS
SELECT
  c.id as conversation_id,
  c.customer_id,
  cust.email as customer_email,
  cust.display_name as customer_name,
  c.work_item_id,
  wi.title as work_item_title,
  wi.status as work_item_status,
  c.subject,
  c.message_count,
  c.last_message_at,
  c.last_message_from,
  c.last_message_direction,
  c.has_unread,
  c.status as conversation_status,
  c.created_at
FROM conversations c
LEFT JOIN customers cust ON c.customer_id = cust.id
LEFT JOIN work_items wi ON c.work_item_id = wi.id
WHERE c.status = 'active'
ORDER BY c.last_message_at DESC;

COMMENT ON VIEW customer_conversations IS
'Active conversations with customer and work item details.';

-- Unread conversations
CREATE OR REPLACE VIEW unread_conversations AS
SELECT
  c.id as conversation_id,
  c.customer_id,
  cust.display_name as customer_name,
  cust.email as customer_email,
  c.subject,
  c.message_count,
  c.last_message_at,
  EXTRACT(HOURS FROM (NOW() - c.last_message_at)) as hours_since_last_message
FROM conversations c
LEFT JOIN customers cust ON c.customer_id = cust.id
WHERE c.has_unread = TRUE
  AND c.status = 'active'
ORDER BY c.last_message_at DESC;

COMMENT ON VIEW unread_conversations IS
'Conversations with unread inbound messages.';

-- 9. ADD UPDATED_AT TRIGGER
-- ============================================================================
CREATE TRIGGER update_conversations_updated_at
BEFORE UPDATE ON conversations
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

-- 10. LOG MIGRATION RESULTS
-- ============================================================================
DO $$
DECLARE
  conversation_count INTEGER;
  thread_count INTEGER;
  orphan_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO conversation_count FROM conversations;
  SELECT COUNT(DISTINCT provider_thread_id) INTO thread_count
  FROM communications
  WHERE provider_thread_id IS NOT NULL;

  SELECT COUNT(*) INTO orphan_count
  FROM communications
  WHERE conversation_id IS NULL
    AND provider_thread_id IS NOT NULL;

  RAISE NOTICE 'Conversations Table Migration Complete';
  RAISE NOTICE '======================================';
  RAISE NOTICE 'Created conversations table';
  RAISE NOTICE 'Added conversation_id to communications';
  RAISE NOTICE '';
  RAISE NOTICE 'Backfill Results:';
  RAISE NOTICE '  Total conversations created: %', conversation_count;
  RAISE NOTICE '  Unique threads processed: %', thread_count;
  RAISE NOTICE '  Orphaned communications: %', orphan_count;
  RAISE NOTICE '';
  RAISE NOTICE 'Created functions:';
  RAISE NOTICE '  - find_or_create_conversation()';
  RAISE NOTICE '  - update_conversation_stats()';
  RAISE NOTICE '';
  RAISE NOTICE 'Created views:';
  RAISE NOTICE '  - customer_conversations';
  RAISE NOTICE '  - unread_conversations';
  RAISE NOTICE '';
  RAISE NOTICE 'CRM Model: Customer → Work Items → Conversations → Messages';
END $$;
