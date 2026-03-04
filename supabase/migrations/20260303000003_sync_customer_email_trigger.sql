-- Sync customer email changes to work_items.customer_email
-- Fixes Issue #19: denormalized customer_email on work_items gets stale when customer updates their email

CREATE OR REPLACE FUNCTION sync_customer_email_to_work_items()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.email IS DISTINCT FROM NEW.email THEN
    UPDATE work_items
    SET customer_email = NEW.email
    WHERE customer_id = NEW.id
      AND (customer_email = OLD.email OR customer_email IS NULL);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_sync_customer_email
AFTER UPDATE ON customers
FOR EACH ROW
WHEN (OLD.email IS DISTINCT FROM NEW.email)
EXECUTE FUNCTION sync_customer_email_to_work_items();
