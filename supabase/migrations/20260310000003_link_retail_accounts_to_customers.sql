-- Link retail accounts to customer records
-- For each retail account without a matching customer, create a new customer record
-- For existing customers typed as 'retailer', try to match by name

DO $$
DECLARE
  ra RECORD;
  existing_customer_id UUID;
  first_name_part TEXT;
  last_name_part TEXT;
BEGIN
  -- Loop over retail accounts that have no customer linked to them
  FOR ra IN
    SELECT r.*
    FROM retail_accounts r
    LEFT JOIN customers c ON c.retail_account_id = r.id
    WHERE c.id IS NULL
  LOOP
    existing_customer_id := NULL;

    -- First try: match by shopify_customer_id
    IF ra.shopify_customer_id IS NOT NULL THEN
      SELECT id INTO existing_customer_id
      FROM customers
      WHERE shopify_customer_id = ra.shopify_customer_id
      LIMIT 1;
    END IF;

    -- Second try: match by organization name (case-insensitive)
    IF existing_customer_id IS NULL AND ra.account_name IS NOT NULL THEN
      SELECT id INTO existing_customer_id
      FROM customers
      WHERE LOWER(TRIM(organization_name)) = LOWER(TRIM(ra.account_name))
      LIMIT 1;
    END IF;

    -- Third try: match by email
    IF existing_customer_id IS NULL AND ra.primary_contact_email IS NOT NULL THEN
      SELECT id INTO existing_customer_id
      FROM customers
      WHERE LOWER(email) = LOWER(ra.primary_contact_email)
      LIMIT 1;
    END IF;

    IF existing_customer_id IS NOT NULL THEN
      -- Link existing customer to this retail account
      UPDATE customers
      SET retail_account_id = ra.id,
          customer_type = 'retailer',
          organization_name = COALESCE(organization_name, ra.account_name)
      WHERE id = existing_customer_id;
    ELSE
      -- Split contact name into first/last
      first_name_part := split_part(COALESCE(ra.primary_contact_name, ''), ' ', 1);
      last_name_part := CASE
        WHEN position(' ' in COALESCE(ra.primary_contact_name, '')) > 0
        THEN substring(ra.primary_contact_name from position(' ' in ra.primary_contact_name) + 1)
        ELSE NULL
      END;

      -- Create new customer record (email is nullable, unique allows multiple NULLs)
      INSERT INTO customers (
        customer_type,
        organization_name,
        first_name,
        last_name,
        email,
        phone,
        shopify_customer_id,
        retail_account_id,
        sales_stage
      ) VALUES (
        'retailer',
        ra.account_name,
        NULLIF(first_name_part, ''),
        last_name_part,
        COALESCE(ra.primary_contact_email, ra.billing_email),
        ra.primary_contact_phone,
        ra.shopify_customer_id,
        ra.id,
        'won'  -- existing retailers who have already placed orders
      );
    END IF;
  END LOOP;
END $$;
