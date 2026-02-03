-- PostgreSQL functions for calculating follow-up dates
-- Based on work item status, event proximity, and configured cadences

-- ============================================================================
-- HELPER FUNCTION: Add Business Days
-- ============================================================================
-- Calculates a future date by adding N business days (Mon-Fri) to a base date
-- Skips weekends automatically

CREATE OR REPLACE FUNCTION add_business_days(base_date TIMESTAMPTZ, days INTEGER)
RETURNS TIMESTAMPTZ AS $$
DECLARE
  result_date TIMESTAMPTZ := base_date;
  added_days INTEGER := 0;
  day_of_week INTEGER;
BEGIN
  -- Handle edge cases
  IF days <= 0 THEN
    RETURN base_date;
  END IF;

  WHILE added_days < days LOOP
    result_date := result_date + INTERVAL '1 day';
    day_of_week := EXTRACT(DOW FROM result_date);

    -- Skip weekends (0 = Sunday, 6 = Saturday)
    IF day_of_week NOT IN (0, 6) THEN
      added_days := added_days + 1;
    END IF;
  END LOOP;

  RETURN result_date;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- ============================================================================
-- MAIN FUNCTION: Calculate Next Follow-Up Date
-- ============================================================================
-- Given a work item ID, calculates when the next follow-up should occur
-- Returns NULL if the work item is closed, paused, or has a pausing cadence

CREATE OR REPLACE FUNCTION calculate_next_follow_up(work_item_id UUID)
RETURNS TIMESTAMPTZ AS $$
DECLARE
  v_work_item RECORD;
  v_cadence RECORD;
  v_days_until_event INTEGER;
  v_base_date TIMESTAMPTZ;
  v_next_follow_up TIMESTAMPTZ;
BEGIN
  -- Get work item details
  SELECT * INTO v_work_item FROM work_items WHERE id = work_item_id;

  -- If work item doesn't exist, return NULL
  IF v_work_item IS NULL THEN
    RETURN NULL;
  END IF;

  -- Skip if closed or manually paused (waiting on customer)
  IF v_work_item.closed_at IS NOT NULL OR v_work_item.is_waiting = true THEN
    RETURN NULL;
  END IF;

  -- Calculate days until event (if event date exists)
  IF v_work_item.event_date IS NOT NULL THEN
    v_days_until_event := EXTRACT(DAY FROM (v_work_item.event_date::TIMESTAMPTZ - NOW()));
  ELSE
    v_days_until_event := NULL;
  END IF;

  -- Find matching cadence (highest priority)
  -- Match on: work_item_type, status, and days_until_event range
  SELECT * INTO v_cadence
  FROM follow_up_cadences
  WHERE work_item_type = v_work_item.type
    AND status = v_work_item.status
    AND is_active = true
    AND (
      -- Match for work items with no event date
      (v_days_until_event IS NULL AND days_until_event_min IS NULL AND days_until_event_max IS NULL)
      OR
      -- Match for work items with event date within range
      (v_days_until_event IS NOT NULL AND
       (days_until_event_min IS NULL OR v_days_until_event >= days_until_event_min) AND
       (days_until_event_max IS NULL OR v_days_until_event <= days_until_event_max))
    )
  ORDER BY priority DESC
  LIMIT 1;

  -- If no matching cadence found, use default 3-day follow-up
  IF v_cadence IS NULL THEN
    v_base_date := COALESCE(v_work_item.last_contact_at, v_work_item.created_at);
    RETURN v_base_date + INTERVAL '3 days';
  END IF;

  -- If cadence pauses follow-up (internal work stages), return NULL
  IF v_cadence.pauses_follow_up = true THEN
    RETURN NULL;
  END IF;

  -- Calculate next follow-up from last contact or creation date
  v_base_date := COALESCE(v_work_item.last_contact_at, v_work_item.created_at);

  -- Apply business days or calendar days based on cadence
  IF v_cadence.business_days_only = true THEN
    v_next_follow_up := add_business_days(v_base_date, v_cadence.follow_up_days);
  ELSE
    v_next_follow_up := v_base_date + (v_cadence.follow_up_days || ' days')::INTERVAL;
  END IF;

  RETURN v_next_follow_up;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- BATCH FUNCTION: Recalculate All Follow-Ups
-- ============================================================================
-- Recalculates follow-up dates for all open work items
-- Also updates rush_order and missed_design_window flags
-- Returns a table of changed work items for logging

CREATE OR REPLACE FUNCTION recalculate_all_follow_ups()
RETURNS TABLE(
  work_item_id UUID,
  old_follow_up TIMESTAMPTZ,
  new_follow_up TIMESTAMPTZ,
  cadence_key TEXT
) AS $$
DECLARE
  v_work_item RECORD;
  v_new_follow_up TIMESTAMPTZ;
  v_new_cadence_key TEXT;
  v_updated_count INTEGER := 0;
  v_days_until INTEGER;
  v_new_rush_order BOOLEAN;
  v_new_missed_window BOOLEAN;
BEGIN
  -- Loop through all open work items
  FOR v_work_item IN
    SELECT id, next_follow_up_at, follow_up_cadence_key, status, type, event_date
    FROM work_items
    WHERE closed_at IS NULL
    ORDER BY created_at ASC
  LOOP
    -- Calculate new follow-up date
    v_new_follow_up := calculate_next_follow_up(v_work_item.id);

    -- Get the cadence key that was used
    SELECT cadence_key INTO v_new_cadence_key
    FROM follow_up_cadences
    WHERE work_item_type = v_work_item.type
      AND status = v_work_item.status
      AND is_active = true
    ORDER BY priority DESC
    LIMIT 1;

    -- Update rush/missed flags if event date exists
    IF v_work_item.event_date IS NOT NULL THEN
      v_days_until := EXTRACT(DAY FROM (v_work_item.event_date::TIMESTAMPTZ - NOW()));

      -- Rush order: event <30 days
      v_new_rush_order := (v_days_until < 30);

      -- Missed design window: event <15 days AND not in production stages
      v_new_missed_window := (
        v_days_until < 15 AND
        v_work_item.status NOT IN (
          'design_fee_paid', 'in_design', 'proof_sent', 'awaiting_approval',
          'invoice_sent', 'paid_ready_for_batch', 'approved', 'ready_for_batch',
          'batched', 'shipped'
        )
      );

      -- Update flags
      UPDATE work_items
      SET
        rush_order = v_new_rush_order,
        missed_design_window = v_new_missed_window
      WHERE id = v_work_item.id;
    END IF;

    -- Update if follow-up date changed
    IF v_new_follow_up IS DISTINCT FROM v_work_item.next_follow_up_at
       OR v_new_cadence_key IS DISTINCT FROM v_work_item.follow_up_cadence_key THEN

      UPDATE work_items
      SET
        next_follow_up_at = v_new_follow_up,
        follow_up_cadence_key = v_new_cadence_key
      WHERE id = v_work_item.id;

      v_updated_count := v_updated_count + 1;

      -- Return row for logging
      work_item_id := v_work_item.id;
      old_follow_up := v_work_item.next_follow_up_at;
      new_follow_up := v_new_follow_up;
      cadence_key := v_new_cadence_key;
      RETURN NEXT;
    END IF;
  END LOOP;

  -- Log summary
  RAISE NOTICE 'Recalculated follow-ups for % work items', v_updated_count;
END;
$$ LANGUAGE plpgsql;

-- Add helpful comments
COMMENT ON FUNCTION add_business_days IS 'Adds N business days (Mon-Fri) to a timestamp, skipping weekends';
COMMENT ON FUNCTION calculate_next_follow_up IS 'Calculates the next follow-up date for a work item based on status, event date, and configured cadences';
COMMENT ON FUNCTION recalculate_all_follow_ups IS 'Recalculates follow-up dates for all open work items and updates rush/missed flags. Intended for nightly cron job.';
