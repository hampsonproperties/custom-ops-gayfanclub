-- ============================================================================
-- Migration: Production Hardening
-- Purpose: Add idempotency, deduplication, and operational safeguards
-- ============================================================================

-- 1. EMAIL DEDUPLICATION
-- ============================================================================
-- Add internet_message_id for Microsoft Graph message identity
ALTER TABLE communications
ADD COLUMN IF NOT EXISTS internet_message_id TEXT;

-- Create unique index on internet_message_id (primary deduplication)
CREATE UNIQUE INDEX IF NOT EXISTS idx_communications_message_id
ON communications(internet_message_id)
WHERE internet_message_id IS NOT NULL;

-- Create composite index for fallback deduplication
-- (from_email, subject, received_at within 1-minute tolerance)
CREATE INDEX IF NOT EXISTS idx_communications_dedupe_fallback
ON communications(from_email, subject, received_at);

-- Add comment documenting deduplication strategy
COMMENT ON COLUMN communications.internet_message_id IS
'Microsoft Graph Message-ID for idempotent email ingestion. Unique constraint prevents duplicate delivery.';


-- 2. WEBHOOK FAILURE RECOVERY
-- ============================================================================
-- Add retry/reprocess tracking to webhook_events
ALTER TABLE webhook_events
ADD COLUMN IF NOT EXISTS processing_status TEXT DEFAULT 'pending'
  CHECK (processing_status IN ('pending', 'processing', 'completed', 'failed', 'skipped')),
ADD COLUMN IF NOT EXISTS processing_error TEXT,
ADD COLUMN IF NOT EXISTS processed_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS retry_count INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS last_retry_at TIMESTAMPTZ;

-- Index for finding failed webhooks to reprocess
CREATE INDEX IF NOT EXISTS idx_webhook_events_failed
ON webhook_events(processing_status, created_at)
WHERE processing_status = 'failed';

-- Index for finding pending webhooks
CREATE INDEX IF NOT EXISTS idx_webhook_events_pending
ON webhook_events(processing_status, created_at)
WHERE processing_status IN ('pending', 'processing');

-- Add comments
COMMENT ON COLUMN webhook_events.processing_status IS
'Webhook processing lifecycle: pending → processing → completed|failed. Failed webhooks can be manually reprocessed.';

COMMENT ON COLUMN webhook_events.retry_count IS
'Number of manual reprocessing attempts. Automatic retries are handled by Shopify.';


-- 3. OWNERSHIP & ACCOUNTABILITY
-- ============================================================================
-- Add ownership tracking to work_items
ALTER TABLE work_items
ADD COLUMN IF NOT EXISTS auto_assigned BOOLEAN DEFAULT false;

-- Index for finding unassigned items
CREATE INDEX IF NOT EXISTS idx_work_items_unassigned
ON work_items(created_at)
WHERE assigned_to_user_id IS NULL;

COMMENT ON COLUMN work_items.auto_assigned IS
'True if assigned via auto-assignment rule (first action), false if manually assigned by admin.';


-- 4. WAITING ON CUSTOMER SEMANTICS
-- ============================================================================
-- Add customer response tracking
ALTER TABLE communications
ADD COLUMN IF NOT EXISTS is_customer_response BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS response_to_communication_id UUID REFERENCES communications(id);

-- Index for finding customer responses
CREATE INDEX IF NOT EXISTS idx_communications_customer_responses
ON communications(work_item_id, is_customer_response, received_at)
WHERE is_customer_response = true;

COMMENT ON COLUMN communications.is_customer_response IS
'True if this is a customer reply to our outbound email. Used to detect response and reset follow-up timers.';


-- 5. CANCELLATION & DEAD LEAD HYGIENE
-- ============================================================================
-- Add closure metadata to work_items
ALTER TABLE work_items
ADD COLUMN IF NOT EXISTS closed_reason TEXT,
ADD COLUMN IF NOT EXISTS closed_by_user_id UUID REFERENCES users(id),
ADD COLUMN IF NOT EXISTS closed_at TIMESTAMPTZ;

-- Index for finding closed items (to exclude from active queries)
CREATE INDEX IF NOT EXISTS idx_work_items_active
ON work_items(status, created_at)
WHERE status NOT IN ('closed_won', 'closed_lost', 'closed_event_cancelled', 'archived');

COMMENT ON COLUMN work_items.closed_reason IS
'User-provided reason for closure. Required for closed_lost and closed_event_cancelled statuses.';


-- 6. SETTINGS & CONFIGURATION
-- ============================================================================
-- Add operational settings
INSERT INTO settings (key, value, description, category) VALUES
-- Email deduplication tolerance (in seconds)
('email_dedupe_tolerance_seconds', '60', 'Time window for fallback email deduplication when Message-ID missing', 'email'),

-- Webhook retry settings
('webhook_max_retry_count', '3', 'Maximum manual reprocessing attempts for failed webhooks', 'webhooks'),
('webhook_retry_delay_minutes', '5', 'Minimum delay between webhook reprocessing attempts', 'webhooks'),

-- Ownership settings
('auto_assign_on_first_action', 'true', 'Automatically assign work item to user who takes first action', 'workflow'),

-- Waiting on customer settings
('waiting_stale_days', '14', 'Days in waiting_on_customer before considered stale', 'workflow'),
('waiting_auto_close_days', '30', 'Days in waiting_on_customer before auto-close consideration', 'workflow'),

-- Closure requirements
('closure_reason_required', 'true', 'Require reason text when closing work items', 'workflow')

ON CONFLICT (key) DO NOTHING;


-- 7. AUDIT ENHANCEMENTS
-- ============================================================================
-- Add more context to status events
ALTER TABLE work_item_status_events
ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}';

COMMENT ON COLUMN work_item_status_events.metadata IS
'Additional context for status change: {action_type: "manual"|"auto", trigger: "webhook"|"user"|"system", etc}';


-- 8. DATA QUALITY INDEXES
-- ============================================================================
-- Index for finding items needing follow-up (performance optimization)
CREATE INDEX IF NOT EXISTS idx_work_items_follow_up_due
ON work_items(next_follow_up_at, status)
WHERE next_follow_up_at IS NOT NULL
  AND status NOT IN ('closed_won', 'closed_lost', 'closed_event_cancelled', 'archived');

-- Index for SLA monitoring in design queue
CREATE INDEX IF NOT EXISTS idx_work_items_design_review_sla
ON work_items(status, created_at)
WHERE status = 'needs_design_review';


-- ============================================================================
-- GRANTS (maintain existing RLS policies)
-- ============================================================================
-- No changes to existing RLS policies - those remain in migration 003
