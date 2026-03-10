-- Add response tracking columns to customers table
-- (columns + indexes already created from partial run, using IF NOT EXISTS)
ALTER TABLE customers
ADD COLUMN IF NOT EXISTS last_inbound_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS last_outbound_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_customers_last_inbound_at ON customers(last_inbound_at);
CREATE INDEX IF NOT EXISTS idx_customers_last_outbound_at ON customers(last_outbound_at);

-- Trigger function: update customer response timestamps when emails are inserted
-- Uses customer_id FK when available, falls back to email matching for inbound
CREATE OR REPLACE FUNCTION update_customer_response_timestamps()
RETURNS TRIGGER AS $$
DECLARE
  v_customer_id UUID;
  v_ts TIMESTAMPTZ;
BEGIN
  IF NEW.direction = 'inbound' THEN
    v_ts := COALESCE(NEW.received_at, NEW.created_at);
    -- Use customer_id if set, otherwise match by from_email
    v_customer_id := NEW.customer_id;
    IF v_customer_id IS NULL AND NEW.from_email IS NOT NULL THEN
      SELECT id INTO v_customer_id
      FROM customers WHERE email = NEW.from_email LIMIT 1;
    END IF;

    IF v_customer_id IS NOT NULL THEN
      UPDATE customers
      SET last_inbound_at = v_ts
      WHERE id = v_customer_id
        AND (last_inbound_at IS NULL OR last_inbound_at < v_ts);
    END IF;

  ELSIF NEW.direction = 'outbound' THEN
    v_ts := COALESCE(NEW.sent_at, NEW.created_at);
    -- Use customer_id if set, otherwise match first to_emails entry
    v_customer_id := NEW.customer_id;
    IF v_customer_id IS NULL AND array_length(NEW.to_emails, 1) > 0 THEN
      SELECT id INTO v_customer_id
      FROM customers WHERE email = NEW.to_emails[1] LIMIT 1;
    END IF;

    IF v_customer_id IS NOT NULL THEN
      UPDATE customers
      SET last_outbound_at = v_ts
      WHERE id = v_customer_id
        AND (last_outbound_at IS NULL OR last_outbound_at < v_ts);
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Attach trigger to communications table
DROP TRIGGER IF EXISTS trg_update_customer_response_timestamps ON communications;
CREATE TRIGGER trg_update_customer_response_timestamps
  AFTER INSERT ON communications
  FOR EACH ROW
  EXECUTE FUNCTION update_customer_response_timestamps();

-- Backfill last_inbound_at: use customer_id where available, fall back to email match
UPDATE customers c
SET last_inbound_at = sub.max_ts
FROM (
  SELECT
    COALESCE(cm.customer_id, cust.id) AS cid,
    MAX(COALESCE(cm.received_at, cm.created_at)) AS max_ts
  FROM communications cm
  LEFT JOIN customers cust ON cust.email = cm.from_email AND cm.customer_id IS NULL
  WHERE cm.direction = 'inbound'
    AND (cm.customer_id IS NOT NULL OR cm.from_email IS NOT NULL)
  GROUP BY COALESCE(cm.customer_id, cust.id)
) sub
WHERE c.id = sub.cid;

-- Backfill last_outbound_at: use customer_id where available, fall back to to_emails[1] match
UPDATE customers c
SET last_outbound_at = sub.max_ts
FROM (
  SELECT
    COALESCE(cm.customer_id, cust.id) AS cid,
    MAX(COALESCE(cm.sent_at, cm.created_at)) AS max_ts
  FROM communications cm
  LEFT JOIN customers cust ON cust.email = cm.to_emails[1] AND cm.customer_id IS NULL
  WHERE cm.direction = 'outbound'
    AND (cm.customer_id IS NOT NULL OR array_length(cm.to_emails, 1) > 0)
  GROUP BY COALESCE(cm.customer_id, cust.id)
) sub
WHERE c.id = sub.cid;

COMMENT ON COLUMN customers.last_inbound_at IS 'Timestamp of most recent inbound email from this customer';
COMMENT ON COLUMN customers.last_outbound_at IS 'Timestamp of most recent outbound email to this customer';
