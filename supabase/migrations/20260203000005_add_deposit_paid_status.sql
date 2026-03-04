-- Add follow-up cadence for "Deposit Paid - Ready for Batch" status
-- This status allows gentle payment reminders (every 7 days) while production proceeds

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
  'assisted_deposit_paid',
  'Deposit Paid - Ready for Batch',
  'Customer has paid deposit. Gentle follow-up reminders for final payment while production proceeds.',
  'assisted_project',
  'deposit_paid_ready_for_batch',
  NULL, -- Applies regardless of event date
  NULL,
  7, -- Follow up weekly for final payment
  false,
  140, -- Between invoice_sent and payment_terms priority
  true,
  false -- Does NOT pause - gentle weekly reminders
)
ON CONFLICT (cadence_key) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  status = EXCLUDED.status,
  follow_up_days = EXCLUDED.follow_up_days,
  pauses_follow_up = EXCLUDED.pauses_follow_up,
  updated_at = NOW();
