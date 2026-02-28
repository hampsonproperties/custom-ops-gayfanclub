-- Migration: Add CRM fields to customers table
-- Date: 2026-02-27
-- Purpose: Add sales pipeline management fields to support PDR V4

-- Add CRM fields to customers table
ALTER TABLE customers
  ADD COLUMN IF NOT EXISTS assigned_to_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS organization_name TEXT,
  ADD COLUMN IF NOT EXISTS estimated_value NUMERIC(10,2),
  ADD COLUMN IF NOT EXISTS next_follow_up_at TIMESTAMPTZ;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_customers_assigned_to
  ON customers(assigned_to_user_id)
  WHERE assigned_to_user_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_customers_next_follow_up
  ON customers(next_follow_up_at)
  WHERE next_follow_up_at IS NOT NULL;

-- Add helpful comments
COMMENT ON COLUMN customers.assigned_to_user_id IS 'User responsible for this customer relationship';
COMMENT ON COLUMN customers.organization_name IS 'Company or organization name';
COMMENT ON COLUMN customers.estimated_value IS 'Estimated total value of customer relationship';
COMMENT ON COLUMN customers.next_follow_up_at IS 'Scheduled date for next follow-up';

-- Verify columns were added
SELECT
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns
WHERE table_name = 'customers'
AND column_name IN ('assigned_to_user_id', 'organization_name', 'estimated_value', 'next_follow_up_at')
ORDER BY column_name;
