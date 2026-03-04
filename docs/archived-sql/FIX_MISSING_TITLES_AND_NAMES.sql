-- ============================================================================
-- Fix: Auto-Generate Titles for Work Items and Improve Naming
-- Purpose: Fix "assisted_project" showing instead of real titles
-- Run this in Supabase SQL Editor
-- ============================================================================

-- STEP 1: Generate titles for work items without one
-- ============================================================================

DO $$
DECLARE
  work_item_record RECORD;
  generated_title TEXT;
  updated_count INTEGER := 0;
BEGIN
  RAISE NOTICE 'Generating titles for work items without titles...';

  FOR work_item_record IN
    SELECT
      id,
      type,
      customer_name,
      customer_email,
      status,
      created_at,
      title
    FROM work_items
    WHERE title IS NULL OR title = ''
  LOOP
    -- Generate title based on available info
    IF work_item_record.customer_name IS NOT NULL THEN
      -- Use customer name if available
      CASE work_item_record.type
        WHEN 'assisted_project' THEN
          generated_title := 'Project for ' || work_item_record.customer_name;
        WHEN 'customify_order' THEN
          generated_title := 'Customify order - ' || work_item_record.customer_name;
        ELSE
          generated_title := 'Order for ' || work_item_record.customer_name;
      END CASE;
    ELSIF work_item_record.customer_email IS NOT NULL THEN
      -- Fallback to email if no name
      generated_title := 'Inquiry from ' || SPLIT_PART(work_item_record.customer_email, '@', 1);
    ELSE
      -- Last resort: use type and date
      generated_title := INITCAP(REPLACE(work_item_record.type, '_', ' ')) ||
                        ' - ' ||
                        TO_CHAR(work_item_record.created_at, 'Mon DD');
    END IF;

    -- Update the work item
    UPDATE work_items
    SET title = generated_title
    WHERE id = work_item_record.id;

    updated_count := updated_count + 1;
  END LOOP;

  RAISE NOTICE 'Generated titles for % work items', updated_count;
END $$;

-- STEP 2: Improve customer name extraction from emails
-- ============================================================================

DO $$
DECLARE
  work_item_record RECORD;
  improved_name TEXT;
  updated_count INTEGER := 0;
BEGIN
  RAISE NOTICE 'Improving customer names extracted from emails...';

  FOR work_item_record IN
    SELECT
      id,
      customer_name,
      customer_email
    FROM work_items
    WHERE customer_email IS NOT NULL
      AND (
        customer_name IS NULL
        OR customer_name = ''
        OR customer_name = SPLIT_PART(customer_email, '@', 1) -- Just email username
        OR LOWER(customer_name) = LOWER(SPLIT_PART(customer_email, '@', 1)) -- Case variations
      )
  LOOP
    -- Try to get a better name from the email username
    improved_name := INITCAP(
      REPLACE(
        REPLACE(
          REPLACE(SPLIT_PART(work_item_record.customer_email, '@', 1), '.', ' '),
          '_', ' '
        ),
        '-', ' '
      )
    );

    -- Only update if we got a meaningful improvement
    IF improved_name != work_item_record.customer_name
       AND improved_name IS NOT NULL
       AND improved_name != '' THEN
      UPDATE work_items
      SET customer_name = improved_name
      WHERE id = work_item_record.id;

      updated_count := updated_count + 1;
    END IF;
  END LOOP;

  RAISE NOTICE 'Improved % customer names', updated_count;
END $$;

-- STEP 3: Create function to auto-generate title on insert/update
-- ============================================================================

CREATE OR REPLACE FUNCTION auto_generate_work_item_title()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  -- Only generate if title is NULL or empty
  IF NEW.title IS NULL OR NEW.title = '' THEN
    IF NEW.customer_name IS NOT NULL THEN
      CASE NEW.type
        WHEN 'assisted_project' THEN
          NEW.title := 'Project for ' || NEW.customer_name;
        WHEN 'customify_order' THEN
          NEW.title := 'Customify order - ' || NEW.customer_name;
        ELSE
          NEW.title := 'Order for ' || NEW.customer_name;
      END CASE;
    ELSIF NEW.customer_email IS NOT NULL THEN
      NEW.title := 'Inquiry from ' || SPLIT_PART(NEW.customer_email, '@', 1);
    ELSE
      NEW.title := INITCAP(REPLACE(NEW.type, '_', ' ')) || ' - ' || TO_CHAR(NOW(), 'Mon DD');
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

-- Add trigger for new work items
DROP TRIGGER IF EXISTS trigger_auto_generate_work_item_title ON work_items;

CREATE TRIGGER trigger_auto_generate_work_item_title
BEFORE INSERT OR UPDATE ON work_items
FOR EACH ROW
EXECUTE FUNCTION auto_generate_work_item_title();

-- STEP 4: Summary
-- ============================================================================

DO $$
DECLARE
  items_without_title INTEGER;
  items_without_customer_name INTEGER;
BEGIN
  SELECT COUNT(*) INTO items_without_title
  FROM work_items
  WHERE title IS NULL OR title = '';

  SELECT COUNT(*) INTO items_without_customer_name
  FROM work_items
  WHERE (customer_name IS NULL OR customer_name = '')
    AND customer_email IS NOT NULL;

  RAISE NOTICE '';
  RAISE NOTICE 'Work Item Naming Fix Complete';
  RAISE NOTICE '=============================';
  RAISE NOTICE 'Items still without title: %', items_without_title;
  RAISE NOTICE 'Items still without customer name: %', items_without_customer_name;
  RAISE NOTICE '';
  RAISE NOTICE 'Future work items will auto-generate titles if none provided!';
  RAISE NOTICE '';
  RAISE NOTICE 'Naming convention:';
  RAISE NOTICE '  - Assisted Projects: "Project for [Customer Name]"';
  RAISE NOTICE '  - Customify Orders: "Customify order - [Customer Name]"';
  RAISE NOTICE '  - Others: "Order for [Customer Name]"';
END $$;
