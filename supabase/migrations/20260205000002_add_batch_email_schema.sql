-- Add batch email queue and tracking schema
-- This supports automated batch progress emails with safety delays and deduplication

-- ============================================================================
-- BATCH EMAIL QUEUE TABLE
-- Stores pending email sends with verification delay mechanism
-- ============================================================================

CREATE TABLE batch_email_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_id UUID NOT NULL REFERENCES batches(id) ON DELETE CASCADE,
  work_item_id UUID NOT NULL REFERENCES work_items(id) ON DELETE CASCADE,

  -- Email details
  email_type TEXT NOT NULL CHECK (email_type IN ('entering_production', 'midway_checkin', 'en_route', 'arrived_stateside')),
  recipient_email TEXT NOT NULL,
  recipient_name TEXT,

  -- Scheduling
  scheduled_send_at TIMESTAMPTZ NOT NULL,

  -- Verification fields (checked before sending)
  expected_batch_status TEXT,
  expected_has_tracking BOOLEAN DEFAULT FALSE,

  -- Status tracking
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'cancelled', 'failed')),
  sent_at TIMESTAMPTZ,
  cancelled_at TIMESTAMPTZ,
  cancellation_reason TEXT,
  error_message TEXT,

  -- Metadata
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Prevent duplicate queuing for same batch/work_item/email_type
  UNIQUE(batch_id, work_item_id, email_type)
);

-- Indexes for efficient querying
CREATE INDEX idx_batch_email_queue_scheduled
  ON batch_email_queue(scheduled_send_at)
  WHERE status = 'pending';

CREATE INDEX idx_batch_email_queue_batch
  ON batch_email_queue(batch_id);

CREATE INDEX idx_batch_email_queue_work_item
  ON batch_email_queue(work_item_id);

CREATE INDEX idx_batch_email_queue_status
  ON batch_email_queue(status);

-- Trigger to update updated_at on row updates
CREATE TRIGGER update_batch_email_queue_updated_at
  BEFORE UPDATE ON batch_email_queue
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

-- Add comment
COMMENT ON TABLE batch_email_queue IS 'Pending batch progress emails with safety verification delay. Emails are queued, then verified before sending to prevent accidental sends on status changes.';
COMMENT ON COLUMN batch_email_queue.email_type IS 'Type of batch progress email: entering_production (day 1), midway_checkin (day 10), en_route (tracking added), arrived_stateside (received at warehouse)';
COMMENT ON COLUMN batch_email_queue.scheduled_send_at IS 'When to send the email. Typically NOW() + 5 minutes for verification delay.';
COMMENT ON COLUMN batch_email_queue.expected_batch_status IS 'Expected batch status at send time. If changed, email is cancelled.';
COMMENT ON COLUMN batch_email_queue.expected_has_tracking IS 'Whether tracking number is required. If removed before send, email is cancelled.';

-- ============================================================================
-- BATCH EMAIL SENDS TABLE
-- Tracks completed email sends for audit trail and deduplication
-- ============================================================================

CREATE TABLE batch_email_sends (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_id UUID NOT NULL REFERENCES batches(id) ON DELETE CASCADE,
  work_item_id UUID NOT NULL REFERENCES work_items(id) ON DELETE CASCADE,

  -- Email details
  email_type TEXT NOT NULL CHECK (email_type IN ('entering_production', 'midway_checkin', 'en_route', 'arrived_stateside')),
  recipient_email TEXT NOT NULL,

  -- Links to other tables
  communication_id UUID REFERENCES communications(id),
  queue_item_id UUID REFERENCES batch_email_queue(id),

  -- Template info
  template_key TEXT NOT NULL,

  -- Metadata
  sent_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Prevent duplicate sends for same batch/work_item/email_type
  UNIQUE(batch_id, work_item_id, email_type)
);

-- Indexes for efficient querying
CREATE INDEX idx_batch_email_sends_batch
  ON batch_email_sends(batch_id);

CREATE INDEX idx_batch_email_sends_work_item
  ON batch_email_sends(work_item_id);

CREATE INDEX idx_batch_email_sends_email_type
  ON batch_email_sends(email_type);

CREATE INDEX idx_batch_email_sends_sent_at
  ON batch_email_sends(sent_at DESC);

-- Add comment
COMMENT ON TABLE batch_email_sends IS 'Audit trail of sent batch progress emails. Used for deduplication and reporting.';
COMMENT ON COLUMN batch_email_sends.communication_id IS 'Link to communications table record for the sent email.';
COMMENT ON COLUMN batch_email_sends.queue_item_id IS 'Link to the queue item that triggered this send.';

-- ============================================================================
-- UPDATE BATCHES TABLE
-- Add received_at_warehouse_at timestamp for Email 4 trigger
-- ============================================================================

ALTER TABLE batches
  ADD COLUMN IF NOT EXISTS received_at_warehouse_at TIMESTAMPTZ;

COMMENT ON COLUMN batches.received_at_warehouse_at IS 'Timestamp when batch was marked as received at U.S. warehouse. Triggers Email 4 (arrived_stateside).';

-- ============================================================================
-- HELPER FUNCTIONS
-- ============================================================================

-- Function to check if an email has already been sent
CREATE OR REPLACE FUNCTION has_batch_email_been_sent(
  p_batch_id UUID,
  p_work_item_id UUID,
  p_email_type TEXT
) RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1
    FROM batch_email_sends
    WHERE batch_id = p_batch_id
      AND work_item_id = p_work_item_id
      AND email_type = p_email_type
  );
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION has_batch_email_been_sent IS 'Check if a specific batch email has already been sent to prevent duplicates.';

-- Function to cancel pending emails for a batch/work_item
CREATE OR REPLACE FUNCTION cancel_pending_batch_emails(
  p_batch_id UUID,
  p_work_item_id UUID,
  p_reason TEXT DEFAULT 'Manually cancelled'
) RETURNS INTEGER AS $$
DECLARE
  v_cancelled_count INTEGER;
BEGIN
  UPDATE batch_email_queue
  SET
    status = 'cancelled',
    cancelled_at = NOW(),
    cancellation_reason = p_reason,
    updated_at = NOW()
  WHERE batch_id = p_batch_id
    AND work_item_id = p_work_item_id
    AND status = 'pending';

  GET DIAGNOSTICS v_cancelled_count = ROW_COUNT;
  RETURN v_cancelled_count;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION cancel_pending_batch_emails IS 'Cancel all pending emails for a specific batch/work_item combination. Returns count of cancelled emails.';

-- Function to get batch email status summary
CREATE OR REPLACE FUNCTION get_batch_email_status(p_batch_id UUID)
RETURNS TABLE (
  work_item_id UUID,
  customer_name TEXT,
  customer_email TEXT,
  entering_production_status TEXT,
  entering_production_scheduled TIMESTAMPTZ,
  entering_production_sent TIMESTAMPTZ,
  midway_checkin_status TEXT,
  midway_checkin_scheduled TIMESTAMPTZ,
  midway_checkin_sent TIMESTAMPTZ,
  en_route_status TEXT,
  en_route_scheduled TIMESTAMPTZ,
  en_route_sent TIMESTAMPTZ,
  arrived_stateside_status TEXT,
  arrived_stateside_scheduled TIMESTAMPTZ,
  arrived_stateside_sent TIMESTAMPTZ
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    wi.id AS work_item_id,
    wi.customer_name,
    wi.customer_email,

    -- Entering Production
    COALESCE(
      (SELECT status FROM batch_email_queue WHERE batch_id = p_batch_id AND work_item_id = wi.id AND email_type = 'entering_production'),
      (SELECT 'sent'::TEXT FROM batch_email_sends WHERE batch_id = p_batch_id AND work_item_id = wi.id AND email_type = 'entering_production'),
      'not_queued'::TEXT
    ) AS entering_production_status,
    (SELECT scheduled_send_at FROM batch_email_queue WHERE batch_id = p_batch_id AND work_item_id = wi.id AND email_type = 'entering_production' AND status = 'pending') AS entering_production_scheduled,
    (SELECT sent_at FROM batch_email_sends WHERE batch_id = p_batch_id AND work_item_id = wi.id AND email_type = 'entering_production') AS entering_production_sent,

    -- Midway Check-In
    COALESCE(
      (SELECT status FROM batch_email_queue WHERE batch_id = p_batch_id AND work_item_id = wi.id AND email_type = 'midway_checkin'),
      (SELECT 'sent'::TEXT FROM batch_email_sends WHERE batch_id = p_batch_id AND work_item_id = wi.id AND email_type = 'midway_checkin'),
      'not_queued'::TEXT
    ) AS midway_checkin_status,
    (SELECT scheduled_send_at FROM batch_email_queue WHERE batch_id = p_batch_id AND work_item_id = wi.id AND email_type = 'midway_checkin' AND status = 'pending') AS midway_checkin_scheduled,
    (SELECT sent_at FROM batch_email_sends WHERE batch_id = p_batch_id AND work_item_id = wi.id AND email_type = 'midway_checkin') AS midway_checkin_sent,

    -- En Route
    COALESCE(
      (SELECT status FROM batch_email_queue WHERE batch_id = p_batch_id AND work_item_id = wi.id AND email_type = 'en_route'),
      (SELECT 'sent'::TEXT FROM batch_email_sends WHERE batch_id = p_batch_id AND work_item_id = wi.id AND email_type = 'en_route'),
      'not_queued'::TEXT
    ) AS en_route_status,
    (SELECT scheduled_send_at FROM batch_email_queue WHERE batch_id = p_batch_id AND work_item_id = wi.id AND email_type = 'en_route' AND status = 'pending') AS en_route_scheduled,
    (SELECT sent_at FROM batch_email_sends WHERE batch_id = p_batch_id AND work_item_id = wi.id AND email_type = 'en_route') AS en_route_sent,

    -- Arrived Stateside
    COALESCE(
      (SELECT status FROM batch_email_queue WHERE batch_id = p_batch_id AND work_item_id = wi.id AND email_type = 'arrived_stateside'),
      (SELECT 'sent'::TEXT FROM batch_email_sends WHERE batch_id = p_batch_id AND work_item_id = wi.id AND email_type = 'arrived_stateside'),
      'not_queued'::TEXT
    ) AS arrived_stateside_status,
    (SELECT scheduled_send_at FROM batch_email_queue WHERE batch_id = p_batch_id AND work_item_id = wi.id AND email_type = 'arrived_stateside' AND status = 'pending') AS arrived_stateside_scheduled,
    (SELECT sent_at FROM batch_email_sends WHERE batch_id = p_batch_id AND work_item_id = wi.id AND email_type = 'arrived_stateside') AS arrived_stateside_sent

  FROM work_items wi
  INNER JOIN batch_items bi ON bi.work_item_id = wi.id
  WHERE bi.batch_id = p_batch_id
  ORDER BY wi.customer_name;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION get_batch_email_status IS 'Get comprehensive email send status for all work items in a batch. Shows queue status, scheduled times, and sent times for all 4 email types.';
