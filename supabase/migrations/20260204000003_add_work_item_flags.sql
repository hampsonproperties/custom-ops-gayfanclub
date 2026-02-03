-- Add flags to work_items table for follow-up management

ALTER TABLE work_items
  ADD COLUMN IF NOT EXISTS requires_initial_contact BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS rush_order BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS missed_design_window BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS is_waiting BOOLEAN DEFAULT false;

-- Add comment to explain each flag
COMMENT ON COLUMN work_items.requires_initial_contact IS 'True for Shopify-first orders that need initial customer contact';
COMMENT ON COLUMN work_items.rush_order IS 'True for orders with event date <30 days out (auto-calculated nightly)';
COMMENT ON COLUMN work_items.missed_design_window IS 'True for orders with event <15 days that have not progressed far enough (auto-calculated nightly)';
COMMENT ON COLUMN work_items.is_waiting IS 'True when manually paused - waiting on customer response';

-- Create index for follow-up calculation queries
CREATE INDEX idx_work_items_follow_up_calc
  ON work_items(status, event_date, is_waiting)
  WHERE closed_at IS NULL;

-- Create index for initial contact flag
CREATE INDEX idx_work_items_initial_contact
  ON work_items(requires_initial_contact)
  WHERE requires_initial_contact = true AND closed_at IS NULL;

-- Create index for rush orders
CREATE INDEX idx_work_items_rush
  ON work_items(rush_order, event_date)
  WHERE rush_order = true AND closed_at IS NULL;

-- Create index for waiting status
CREATE INDEX idx_work_items_waiting
  ON work_items(is_waiting, updated_at)
  WHERE is_waiting = true AND closed_at IS NULL;
