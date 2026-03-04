-- ============================================================================
-- Sprint 8: Add Database Transactions for Multi-Step Operations
-- Created: 2026-03-03
--
-- Two RPC functions that wrap multi-step operations in transactions:
-- 1. create_batch_with_items() — atomically creates batch + items + updates work_items
-- 2. change_work_item_status() — atomically updates status + creates audit event
--
-- PL/pgSQL functions are automatically transactional — if any statement fails,
-- the entire function's changes are rolled back. No explicit BEGIN/COMMIT needed.
-- ============================================================================

-- ============================================================================
-- 1. CREATE BATCH WITH ITEMS (Atomic)
--
-- Previously: 3 separate Supabase calls (insert batch, insert batch_items, update work_items)
-- If step 2 or 3 failed, you'd get an empty batch or items without status updates.
--
-- Now: Single RPC call. All 3 steps succeed or all roll back.
-- ============================================================================

CREATE OR REPLACE FUNCTION create_batch_with_items(
  p_name TEXT,
  p_created_by_user_id UUID,
  p_work_item_ids UUID[]
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_batch_id UUID;
  v_work_item_id UUID;
  v_position INT := 0;
BEGIN
  -- Validate inputs
  IF p_name IS NULL OR p_name = '' THEN
    RAISE EXCEPTION 'Batch name is required';
  END IF;

  IF p_work_item_ids IS NULL OR array_length(p_work_item_ids, 1) IS NULL THEN
    RAISE EXCEPTION 'At least one work item ID is required';
  END IF;

  -- Step 1: Create the batch
  INSERT INTO batches (name, status, created_by_user_id)
  VALUES (p_name, 'draft', p_created_by_user_id)
  RETURNING id INTO v_batch_id;

  -- Step 2: Insert batch items with positions
  FOREACH v_work_item_id IN ARRAY p_work_item_ids LOOP
    v_position := v_position + 1;
    INSERT INTO batch_items (batch_id, work_item_id, position)
    VALUES (v_batch_id, v_work_item_id, v_position);
  END LOOP;

  -- Step 3: Update all work items to link to this batch
  UPDATE work_items
  SET batch_id = v_batch_id,
      batched_at = NOW(),
      status = 'batched',
      updated_at = NOW()
  WHERE id = ANY(p_work_item_ids);

  RETURN v_batch_id;
END;
$$;

-- ============================================================================
-- 2. CHANGE WORK ITEM STATUS (Atomic)
--
-- Previously: 2 separate calls (update work_items.status, insert status event)
-- If the event insert failed, you'd have a status change with no audit trail.
--
-- Now: Single RPC call. Status update + audit event are atomic.
-- ============================================================================

CREATE OR REPLACE FUNCTION change_work_item_status(
  p_work_item_id UUID,
  p_new_status TEXT,
  p_changed_by_user_id UUID DEFAULT NULL,
  p_note TEXT DEFAULT NULL
)
RETURNS TABLE(old_status TEXT, new_status TEXT)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_old_status TEXT;
BEGIN
  -- Get current status (lock the row to prevent concurrent updates)
  SELECT w.status INTO v_old_status
  FROM work_items w
  WHERE w.id = p_work_item_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Work item not found: %', p_work_item_id;
  END IF;

  -- Skip if status hasn't changed
  IF v_old_status = p_new_status THEN
    RETURN QUERY SELECT v_old_status, p_new_status;
    RETURN;
  END IF;

  -- Step 1: Update the status
  UPDATE work_items
  SET status = p_new_status,
      updated_at = NOW()
  WHERE id = p_work_item_id;

  -- Step 2: Create audit trail event
  INSERT INTO work_item_status_events (
    work_item_id,
    from_status,
    to_status,
    changed_by_user_id,
    note
  ) VALUES (
    p_work_item_id,
    v_old_status,
    p_new_status,
    p_changed_by_user_id,
    p_note
  );

  RETURN QUERY SELECT v_old_status, p_new_status;
END;
$$;
