-- Add sales pipeline stages to customers table
-- =================================================================
-- This enables the Customer Kanban Pipeline view for managing sales process

-- Create enum type for sales stages
DO $$ BEGIN
  CREATE TYPE sales_stage_enum AS ENUM (
    'new_lead',
    'contacted',
    'in_discussion',
    'quoted',
    'negotiating',
    'won',
    'active_customer',
    'lost'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- Add sales_stage column to customers table
ALTER TABLE customers
ADD COLUMN IF NOT EXISTS sales_stage sales_stage_enum DEFAULT 'new_lead';

-- Create index for filtering by sales stage
CREATE INDEX IF NOT EXISTS idx_customers_sales_stage
ON customers(sales_stage);

-- Add column comment
COMMENT ON COLUMN customers.sales_stage IS 'Current stage in the sales pipeline for Kanban view';

-- Update existing customers without a stage to 'active_customer' if they have projects
UPDATE customers
SET sales_stage = 'active_customer'
WHERE sales_stage = 'new_lead'
  AND id IN (
    SELECT DISTINCT customer_id
    FROM work_items
    WHERE customer_id IS NOT NULL
  );
