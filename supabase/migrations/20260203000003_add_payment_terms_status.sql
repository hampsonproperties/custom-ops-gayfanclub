-- Add follow-up cadence for "On Payment Terms - Ready for Batch" status
-- This status pauses payment follow-ups while allowing batching

INSERT INTO follow_up_cadences (
  cadence_key,
  name,
  description,
  work_item_type,
  status,
  days_until_event_min,
  days_until_event_max,
  follow_up_days,
  business_days_only,
  priority,
  is_active,
  pauses_follow_up
) VALUES (
  'assisted_on_payment_terms',
  'On Payment Terms - Ready for Batch',
  'Customer is on payment terms. No follow-up needed as we''re proceeding with production while awaiting payment.',
  'assisted_project',
  'on_payment_terms_ready_for_batch',
  NULL, -- Applies regardless of event date
  NULL,
  999, -- High number so it doesn''t interfere, but pauses_follow_up is what matters
  false,
  150, -- Higher priority than normal statuses
  true,
  true -- PAUSES follow-ups - this is the key!
)
ON CONFLICT (cadence_key) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  status = EXCLUDED.status,
  pauses_follow_up = EXCLUDED.pauses_follow_up,
  updated_at = NOW();
