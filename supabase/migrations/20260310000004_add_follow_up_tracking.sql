-- CRM Phase 2: Add follow-up reason and cadence tracking to customers
-- These columns let the system tag WHY a follow-up was set and track
-- multi-touch cadences (win-back sequences).

ALTER TABLE customers
  ADD COLUMN IF NOT EXISTS follow_up_reason text,
  ADD COLUMN IF NOT EXISTS follow_up_touch_number integer,
  ADD COLUMN IF NOT EXISTS follow_up_max_touches integer;

-- Add a CHECK constraint to limit follow_up_reason to known values
ALTER TABLE customers
  ADD CONSTRAINT customers_follow_up_reason_check
  CHECK (follow_up_reason IS NULL OR follow_up_reason IN (
    'post-delivery',
    'win-back',
    'reorder-prompt',
    'seasonal',
    'manual'
  ));

-- Add comments for documentation
COMMENT ON COLUMN customers.follow_up_reason IS 'Why the follow-up was set: post-delivery, win-back, reorder-prompt, seasonal, or manual';
COMMENT ON COLUMN customers.follow_up_touch_number IS 'Current touch number in a multi-touch cadence (1-based)';
COMMENT ON COLUMN customers.follow_up_max_touches IS 'Maximum touches in the cadence before stopping';
