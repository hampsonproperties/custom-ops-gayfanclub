-- Add missing cadences for assisted_project production statuses
-- These should pause follow-ups (no customer contact needed during production/fulfillment)

-- Batched - In production batch
INSERT INTO follow_up_cadences (
  cadence_key, name, description,
  work_item_type, status,
  days_until_event_min, days_until_event_max,
  follow_up_days, business_days_only, priority, pauses_follow_up
) VALUES
('assisted_batched', 'Batched', 'In production batch',
 'assisted_project', 'batched', NULL, NULL, 999, false, 100, true);

-- Shipped - Order fulfilled
INSERT INTO follow_up_cadences (
  cadence_key, name, description,
  work_item_type, status,
  days_until_event_min, days_until_event_max,
  follow_up_days, business_days_only, priority, pauses_follow_up
) VALUES
('assisted_shipped', 'Shipped', 'Order shipped to customer',
 'assisted_project', 'shipped', NULL, NULL, 999, false, 100, true);
