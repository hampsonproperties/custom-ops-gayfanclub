-- ============================================================================
-- Data Health Diagnostic Functions
-- Used by the Data Health section in Settings to check data integrity
-- ============================================================================

-- 1. Count customers where stored total_spent differs from actual order sum
-- Returns the count and a sample of up to 10 mismatched records for preview
CREATE OR REPLACE FUNCTION count_aggregate_mismatches()
RETURNS TABLE(mismatch_count BIGINT, details JSONB) AS $$
BEGIN
  RETURN QUERY
  WITH mismatches AS (
    SELECT
      c.id,
      c.display_name,
      c.email,
      COALESCE(c.total_spent, 0)::NUMERIC as stored_total,
      COALESCE(SUM(co.total_price), 0)::NUMERIC as actual_total,
      ROW_NUMBER() OVER (ORDER BY ABS(COALESCE(c.total_spent, 0) - COALESCE(SUM(co.total_price), 0)) DESC) as rn
    FROM customers c
    LEFT JOIN customer_orders co ON co.customer_id = c.id
    GROUP BY c.id, c.display_name, c.email, c.total_spent
    HAVING COALESCE(c.total_spent, 0) != COALESCE(SUM(co.total_price), 0)
  )
  SELECT
    COUNT(*)::BIGINT as mismatch_count,
    COALESCE(
      jsonb_agg(
        jsonb_build_object(
          'customer_id', m.id,
          'display_name', m.display_name,
          'email', m.email,
          'stored_total', m.stored_total,
          'actual_total', m.actual_total,
          'difference', m.actual_total - m.stored_total
        )
      ) FILTER (WHERE m.rn <= 10),
      '[]'::JSONB
    ) as details
  FROM mismatches m;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

-- 2. Count customers sharing the same email address (potential duplicates)
-- Returns count of duplicate groups and sample details
CREATE OR REPLACE FUNCTION count_duplicate_customers()
RETURNS TABLE(duplicate_count BIGINT, details JSONB) AS $$
BEGIN
  RETURN QUERY
  WITH dupes AS (
    SELECT
      customers.email,
      COUNT(*) as cnt,
      ROW_NUMBER() OVER (ORDER BY COUNT(*) DESC) as rn
    FROM customers
    WHERE email IS NOT NULL AND email != ''
    GROUP BY customers.email
    HAVING COUNT(*) > 1
  )
  SELECT
    COUNT(*)::BIGINT as duplicate_count,
    COALESCE(
      jsonb_agg(
        jsonb_build_object(
          'email', d.email,
          'count', d.cnt
        )
      ) FILTER (WHERE d.rn <= 10),
      '[]'::JSONB
    ) as details
  FROM dupes d;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

-- 3. Bulk recalculate all customer aggregates
-- Calls the existing update_customer_aggregates() for every customer with orders
-- Returns count of customers recalculated
CREATE OR REPLACE FUNCTION recalculate_all_customer_aggregates()
RETURNS TABLE(recalculated_count BIGINT) AS $$
DECLARE
  cust_id UUID;
  counter BIGINT := 0;
BEGIN
  FOR cust_id IN
    SELECT DISTINCT c.id
    FROM customers c
    LEFT JOIN customer_orders co ON co.customer_id = c.id
    -- Include all customers: those with orders AND those whose totals are non-zero
    -- (catches customers who lost their orders but still show old totals)
    WHERE co.customer_id IS NOT NULL OR COALESCE(c.total_spent, 0) != 0 OR COALESCE(c.total_orders, 0) != 0
  LOOP
    PERFORM update_customer_aggregates(cust_id);
    counter := counter + 1;
  END LOOP;

  RETURN QUERY SELECT counter;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION count_aggregate_mismatches IS 'Data health: counts customers where total_spent differs from actual order sum';
COMMENT ON FUNCTION count_duplicate_customers IS 'Data health: counts groups of customers sharing the same email address';
COMMENT ON FUNCTION recalculate_all_customer_aggregates IS 'Data health: recalculates total_spent/total_orders for all customers with orders';
