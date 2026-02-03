-- Seed follow_up_cadences with initial cadence rules
-- Based on event proximity and work item status

-- ============================================================================
-- ASSISTED PROJECT CADENCES (Event-aware sales pipeline)
-- ============================================================================

-- New Inquiry - Event <30 days (RUSH)
INSERT INTO follow_up_cadences (
  cadence_key, name, description,
  work_item_type, status,
  days_until_event_min, days_until_event_max,
  follow_up_days, business_days_only, priority
) VALUES
('assisted_new_inquiry_rush', 'New Inquiry - Rush (<30 days)', 'Urgent follow-up for inquiries with events less than 30 days out',
 'assisted_project', 'new_inquiry', 0, 30, 2, false, 200);

-- New Inquiry - Event 30-60 days
INSERT INTO follow_up_cadences (
  cadence_key, name, description,
  work_item_type, status,
  days_until_event_min, days_until_event_max,
  follow_up_days, business_days_only, priority
) VALUES
('assisted_new_inquiry_30_60', 'New Inquiry - 30-60 days out', 'Follow-up for inquiries with events 30-60 days away',
 'assisted_project', 'new_inquiry', 30, 60, 3, false, 150);

-- New Inquiry - Event 60-90 days
INSERT INTO follow_up_cadences (
  cadence_key, name, description,
  work_item_type, status,
  days_until_event_min, days_until_event_max,
  follow_up_days, business_days_only, priority
) VALUES
('assisted_new_inquiry_60_90', 'New Inquiry - 60-90 days out', 'Follow-up for inquiries with events 60-90 days away',
 'assisted_project', 'new_inquiry', 60, 90, 5, false, 120);

-- New Inquiry - Event 90+ days
INSERT INTO follow_up_cadences (
  cadence_key, name, description,
  work_item_type, status,
  days_until_event_min, days_until_event_max,
  follow_up_days, business_days_only, priority
) VALUES
('assisted_new_inquiry_90_plus', 'New Inquiry - 90+ days out', 'Follow-up for inquiries with events 90+ days away',
 'assisted_project', 'new_inquiry', 90, NULL, 7, false, 100);

-- New Inquiry - No Event (Wholesale/Ongoing)
INSERT INTO follow_up_cadences (
  cadence_key, name, description,
  work_item_type, status,
  days_until_event_min, days_until_event_max,
  follow_up_days, business_days_only, priority
) VALUES
('assisted_new_inquiry_no_event', 'New Inquiry - No Event Date', 'Follow-up for wholesale or ongoing projects without specific event dates',
 'assisted_project', 'new_inquiry', NULL, NULL, 7, false, 50);

-- Info Sent - Active follow-up
INSERT INTO follow_up_cadences (
  cadence_key, name, description,
  work_item_type, status,
  days_until_event_min, days_until_event_max,
  follow_up_days, business_days_only, priority
) VALUES
('assisted_info_sent', 'Info Sent', 'Follow-up after sending initial information to prospect',
 'assisted_project', 'info_sent', NULL, NULL, 5, false, 100);

-- Future Event Monitoring - Quarterly check-in
INSERT INTO follow_up_cadences (
  cadence_key, name, description,
  work_item_type, status,
  days_until_event_min, days_until_event_max,
  follow_up_days, business_days_only, priority
) VALUES
('assisted_future_event', 'Future Event Monitoring', 'Quarterly check-in for events far in the future',
 'assisted_project', 'future_event_monitoring', NULL, NULL, 90, false, 100);

-- Design Fee Sent - High priority (blocking payment)
INSERT INTO follow_up_cadences (
  cadence_key, name, description,
  work_item_type, status,
  days_until_event_min, days_until_event_max,
  follow_up_days, business_days_only, priority
) VALUES
('assisted_design_fee_sent', 'Design Fee Invoice Sent', 'Follow-up on unpaid design fee invoice',
 'assisted_project', 'design_fee_sent', NULL, NULL, 4, false, 100);

-- Design Fee Paid - Pauses follow-up (internal work)
INSERT INTO follow_up_cadences (
  cadence_key, name, description,
  work_item_type, status,
  days_until_event_min, days_until_event_max,
  follow_up_days, business_days_only, priority, pauses_follow_up
) VALUES
('assisted_design_fee_paid', 'Design Fee Paid', 'Internal design work - no customer follow-up needed',
 'assisted_project', 'design_fee_paid', NULL, NULL, 999, false, 100, true);

-- In Design - Pauses follow-up (internal work)
INSERT INTO follow_up_cadences (
  cadence_key, name, description,
  work_item_type, status,
  days_until_event_min, days_until_event_max,
  follow_up_days, business_days_only, priority, pauses_follow_up
) VALUES
('assisted_in_design', 'In Design', 'Internal design work - no customer follow-up needed',
 'assisted_project', 'in_design', NULL, NULL, 999, false, 100, true);

-- Proof Sent - URGENT (blocking approval)
INSERT INTO follow_up_cadences (
  cadence_key, name, description,
  work_item_type, status,
  days_until_event_min, days_until_event_max,
  follow_up_days, business_days_only, priority
) VALUES
('assisted_proof_sent', 'Proof Sent - Awaiting Approval', 'Urgent follow-up on proof approval to keep project on schedule',
 'assisted_project', 'proof_sent', NULL, NULL, 3, false, 100);

-- Awaiting Approval - URGENT (blocking approval)
INSERT INTO follow_up_cadences (
  cadence_key, name, description,
  work_item_type, status,
  days_until_event_min, days_until_event_max,
  follow_up_days, business_days_only, priority
) VALUES
('assisted_awaiting_approval', 'Awaiting Approval', 'Urgent follow-up for pending proof approval',
 'assisted_project', 'awaiting_approval', NULL, NULL, 3, false, 100);

-- Invoice Sent - High priority (blocking payment)
INSERT INTO follow_up_cadences (
  cadence_key, name, description,
  work_item_type, status,
  days_until_event_min, days_until_event_max,
  follow_up_days, business_days_only, priority
) VALUES
('assisted_invoice_sent', 'Final Invoice Sent', 'Follow-up on unpaid final invoice',
 'assisted_project', 'invoice_sent', NULL, NULL, 4, false, 100);

-- Paid Ready for Batch - Pauses follow-up (production stage)
INSERT INTO follow_up_cadences (
  cadence_key, name, description,
  work_item_type, status,
  days_until_event_min, days_until_event_max,
  follow_up_days, business_days_only, priority, pauses_follow_up
) VALUES
('assisted_paid_ready', 'Paid - Ready for Batch', 'In production queue - no customer follow-up needed',
 'assisted_project', 'paid_ready_for_batch', NULL, NULL, 999, false, 100, true);

-- Closed statuses - Pauses follow-up
INSERT INTO follow_up_cadences (
  cadence_key, name, description,
  work_item_type, status,
  days_until_event_min, days_until_event_max,
  follow_up_days, business_days_only, priority, pauses_follow_up
) VALUES
('assisted_closed_won', 'Closed - Won', 'Project completed successfully',
 'assisted_project', 'closed_won', NULL, NULL, 999, false, 100, true),
('assisted_closed_lost', 'Closed - Lost', 'Project lost',
 'assisted_project', 'closed_lost', NULL, NULL, 999, false, 100, true),
('assisted_closed_cancelled', 'Closed - Event Cancelled', 'Event cancelled by customer',
 'assisted_project', 'closed_event_cancelled', NULL, NULL, 999, false, 100, true);

-- ============================================================================
-- CUSTOMIFY ORDER CADENCES (Shopify order fulfillment)
-- ============================================================================

-- Needs Design Review - Review within 8 business hours
INSERT INTO follow_up_cadences (
  cadence_key, name, description,
  work_item_type, status,
  days_until_event_min, days_until_event_max,
  follow_up_days, business_days_only, priority, pauses_follow_up
) VALUES
('customify_needs_review', 'Needs Design Review', 'Internal design review - no customer follow-up',
 'customify_order', 'needs_design_review', NULL, NULL, 999, false, 100, true);

-- Needs Customer Fix - High priority
INSERT INTO follow_up_cadences (
  cadence_key, name, description,
  work_item_type, status,
  days_until_event_min, days_until_event_max,
  follow_up_days, business_days_only, priority
) VALUES
('customify_needs_fix', 'Needs Customer Fix', 'Follow-up on required design changes from customer',
 'customify_order', 'needs_customer_fix', NULL, NULL, 3, false, 100);

-- Approved - Pauses follow-up (production)
INSERT INTO follow_up_cadences (
  cadence_key, name, description,
  work_item_type, status,
  days_until_event_min, days_until_event_max,
  follow_up_days, business_days_only, priority, pauses_follow_up
) VALUES
('customify_approved', 'Approved', 'Design approved - in production queue',
 'customify_order', 'approved', NULL, NULL, 999, false, 100, true);

-- Ready for Batch - Pauses follow-up (production)
INSERT INTO follow_up_cadences (
  cadence_key, name, description,
  work_item_type, status,
  days_until_event_min, days_until_event_max,
  follow_up_days, business_days_only, priority, pauses_follow_up
) VALUES
('customify_ready_batch', 'Ready for Batch', 'Ready for batching - in production queue',
 'customify_order', 'ready_for_batch', NULL, NULL, 999, false, 100, true);

-- Batched - Pauses follow-up (production)
INSERT INTO follow_up_cadences (
  cadence_key, name, description,
  work_item_type, status,
  days_until_event_min, days_until_event_max,
  follow_up_days, business_days_only, priority, pauses_follow_up
) VALUES
('customify_batched', 'Batched', 'In production batch',
 'customify_order', 'batched', NULL, NULL, 999, false, 100, true);

-- Shipped - Pauses follow-up (fulfilled)
INSERT INTO follow_up_cadences (
  cadence_key, name, description,
  work_item_type, status,
  days_until_event_min, days_until_event_max,
  follow_up_days, business_days_only, priority, pauses_follow_up
) VALUES
('customify_shipped', 'Shipped', 'Order shipped',
 'customify_order', 'shipped', NULL, NULL, 999, false, 100, true);

-- Closed - Pauses follow-up
INSERT INTO follow_up_cadences (
  cadence_key, name, description,
  work_item_type, status,
  days_until_event_min, days_until_event_max,
  follow_up_days, business_days_only, priority, pauses_follow_up
) VALUES
('customify_closed', 'Closed', 'Order closed',
 'customify_order', 'closed', NULL, NULL, 999, false, 100, true);
