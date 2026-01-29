# Linking Real Emails to Existing Orders

## Scenario

You have:
- ✅ Real emails in the Email Intake queue
- ✅ Real Shopify orders (Customify + Custom Design Service)
- ❌ They're not connected yet

This guide shows how to connect them.

---

## **Step 1: Import Historical Orders**

First, bring your Shopify orders into Custom Ops.

### Option A: Import via API (Recommended)

**1. Add Shopify credentials to `.env.local`:**

```bash
SHOPIFY_STORE_DOMAIN=your-store.myshopify.com
SHOPIFY_ADMIN_API_TOKEN=shpat_xxxxxxxxxxxxx
```

**2. Run the import:**

```bash
# Import last 6 months of orders
curl -X POST http://localhost:3000/api/shopify/import-orders \
  -H "Content-Type: application/json" \
  -d '{
    "startDate": "2024-07-01T00:00:00Z",
    "endDate": "2025-01-28T23:59:59Z"
  }'
```

This will:
- ✅ Import all Customify orders as work items
- ✅ Import Custom Design Service orders
- ✅ Extract Customify file URLs
- ✅ Set status to `approved` (since they're old)
- ✅ Skip duplicates automatically

**3. Check the results:**

Go to Work Items page - you should see all imported orders.

---

## **Step 2: Auto-Match Emails to Orders**

Some emails might already match orders by customer email. Let's find them.

### Run Auto-Match Query

Go to Supabase SQL Editor and run:

```sql
-- Find emails that match work items by customer email
SELECT
  e.id as email_id,
  e.from_email,
  e.subject,
  e.received_at,
  w.id as work_item_id,
  w.customer_name,
  w.shopify_order_number,
  w.status
FROM communications e
LEFT JOIN work_items w ON e.from_email = w.customer_email
WHERE e.work_item_id IS NULL  -- Not already linked
  AND e.direction = 'inbound'
  AND w.id IS NOT NULL         -- Has a match
ORDER BY e.received_at DESC;
```

This shows you emails that CAN be auto-linked to work items.

### Auto-Link Them (Run SQL)

```sql
-- Auto-link emails to work items by customer email
UPDATE communications
SET work_item_id = w.id
FROM work_items w
WHERE communications.from_email = w.customer_email
  AND communications.work_item_id IS NULL
  AND communications.direction = 'inbound'
  AND w.closed_at IS NULL;
```

This will automatically attach matching emails to work items!

---

## **Step 3: Manual Linking for Remaining Emails**

Some emails won't auto-match (different email address, no order yet, etc.).

### Option A: Via SQL (Quick)

**Find unlinked emails:**

```sql
SELECT
  id,
  from_email,
  subject,
  body_preview,
  received_at
FROM communications
WHERE work_item_id IS NULL
  AND direction = 'inbound'
  AND triage_status = 'untriaged'
ORDER BY received_at DESC
LIMIT 20;
```

**Find work items for a specific customer:**

```sql
SELECT
  id,
  customer_name,
  customer_email,
  shopify_order_number,
  status,
  type
FROM work_items
WHERE customer_email ILIKE '%sarah@example.com%'
   OR customer_name ILIKE '%Sarah%'
ORDER BY created_at DESC;
```

**Manually link them:**

```sql
-- Link email to work item
UPDATE communications
SET work_item_id = 'work-item-uuid-here'
WHERE id = 'email-uuid-here';
```

### Option B: Use Email Intake UI

1. Go to **Email Intake** page
2. Find the email
3. Click **"Create Lead"** if it's a new inquiry
4. Or manually update the database to attach to existing work item

---

## **Step 4: Handle Edge Cases**

### Case 1: Email from customer but no order exists yet

**What it means:** Inquiry email before they placed order.

**What to do:**
1. Create Lead from Email Intake
2. When they place order, webhook will find this work item by email
3. Will auto-link the Shopify order to the existing work item

### Case 2: Email from different address than order

**What it means:** Customer used personal@gmail.com to order but emailed from work@company.com.

**What to do:**
1. Manually link via SQL (see above)
2. Or update work item's customer_email to match

### Case 3: Order exists but customer never emailed

**What it means:** They just ordered via Customify, no email communication.

**What to do:**
- Nothing needed! Work item exists, just no emails attached.
- If they email later, it will auto-attach by email address.

---

## **Step 5: Verify Connections**

Check that everything is linked correctly:

```sql
-- Work items with communications
SELECT
  w.id,
  w.customer_name,
  w.shopify_order_number,
  COUNT(c.id) as email_count
FROM work_items w
LEFT JOIN communications c ON c.work_item_id = w.id
GROUP BY w.id, w.customer_name, w.shopify_order_number
ORDER BY email_count DESC;
```

---

## **Quick Reference: SQL Snippets**

### Find work item by customer email

```sql
SELECT * FROM work_items
WHERE customer_email = 'customer@example.com';
```

### Find all emails from a customer

```sql
SELECT * FROM communications
WHERE from_email = 'customer@example.com'
ORDER BY received_at DESC;
```

### Link email to work item

```sql
UPDATE communications
SET work_item_id = 'uuid-of-work-item'
WHERE id = 'uuid-of-email';
```

### Unlink email from work item

```sql
UPDATE communications
SET work_item_id = NULL
WHERE id = 'uuid-of-email';
```

### Create work item from email manually

```sql
INSERT INTO work_items (
  type,
  source,
  status,
  customer_name,
  customer_email,
  title
) VALUES (
  'assisted_project',
  'email',
  'new_inquiry',
  'Customer Name',
  'customer@example.com',
  'Custom fan design inquiry'
);
```

---

## **UI Feature: Link Email Tool (Future)**

We could build a page that:
- Shows all unlinked emails
- For each email, suggests matching work items by email address
- One-click to link them
- Search for work items if no auto-match

Would you like this built?

---

## **Best Practices**

1. **Import orders first** - Then emails can auto-attach
2. **Use auto-match query** - Links 80% automatically
3. **Manual review remaining** - Check the ones that didn't auto-match
4. **Check Timeline tab** - Verify emails show up correctly

---

## **Example Workflow**

**Real scenario:**

You have:
- Email from sarah@example.com on Jan 15: "Can you design a custom fan?"
- Shopify order #6510 from sarah@example.com on Jan 18: Custom Design Service

**Steps:**

1. Email creates work item via Email Intake → work_item_1 (type: assisted_project, status: new_inquiry)
2. Import orders → finds order #6510
3. Webhook detects it's Custom Design Service
4. **Auto-matches by email** → Updates work_item_1 with shopify_order_id = 6510, status = design_fee_paid
5. Timeline now shows: Email (Jan 15) → Order created (Jan 18)

Everything is connected! ✅

---

Need help with any of these steps? Let me know which approach you want to use!
