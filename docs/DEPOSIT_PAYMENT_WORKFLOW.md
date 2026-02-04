# Deposit Payment Workflow

How to handle 50% deposit + 50% final payment orders so webhooks update automatically.

## ✅ Recommended Method (Works Automatically)

### **Use ONE Shopify Order with Partial Payments**

**Step 1: Create Full Order**
1. Create a Shopify order for the **full amount** (e.g., $2,000)
2. Add all line items (200 fans @ $10/each)
3. Save the order

**Step 2: Send Deposit Invoice**
1. In the order, click **Collect Payment**
2. Choose **"Partial Payment"**
3. Enter 50% amount (e.g., $1,000)
4. Send invoice to customer

**Step 3: Customer Pays Deposit**
- Customer pays $1,000
- Shopify updates to: `financial_status: "partially_paid"`
- **Webhook automatically updates status to:** `deposit_paid_ready_for_batch` ✅
- Order can now be added to print batch

**Step 4: Send Final Invoice (Later)**
1. When ready to ship, click **Collect Payment** again
2. Send invoice for remaining $1,000
3. Customer pays

**Step 5: Customer Pays Final**
- Customer pays remaining $1,000
- Shopify updates to: `financial_status: "paid"`
- **Webhook automatically updates status to:** `paid_ready_for_batch` ✅
- Ready to ship

### Why This Works

Shopify tracks:
- `total_price`: $2,000
- `total_outstanding`: Starts at $2,000, goes to $1,000 after deposit, then $0 when paid
- `financial_status`:
  - `pending` → `partially_paid` → `paid`

Your webhook handler sees these changes and updates statuses automatically!

---

## ❌ Method to Avoid (Doesn't Work Automatically)

### **Creating Separate Orders for Each Invoice**

**Don't do this:**
1. ❌ Create Order #6540 for $1,000 (deposit)
2. ❌ Customer pays → Shows as "paid" (system thinks it's fully paid)
3. ❌ Create Order #6541 for $1,000 (final)
4. ❌ Customer pays → Shows as "paid" (creates duplicate work item)

**Problems:**
- Each order shows as fully "paid" individually
- System can't tell which is deposit vs final
- Creates duplicate work items
- Requires manual status updates

---

## How to Set Up Partial Payments in Shopify

### Option 1: Manual Partial Payment

1. Create order (mark as unpaid)
2. Click **Collect Payment**
3. Select **"Send invoice"**
4. Check **"Allow partial payments"** (if available)
5. Or just enter the partial amount you want to collect

### Option 2: Shopify Payment Terms (Shopify Plus)

If you have Shopify Plus:
1. Enable Payment Terms in Settings
2. Create order with payment terms: "50% due now, 50% due on delivery"
3. Shopify handles the rest automatically

### Option 3: Draft Orders

1. Create a **Draft Order** for full amount
2. Add a discount line for -50%
3. Send invoice
4. When paid, remove discount and send second invoice

---

## Migrating Existing Orders

If you already have separate invoices like #6540:

### Quick Fix (Manual)
1. Run the update script: `npm run update:6540-deposit`
2. Manually track that final payment is still due

### Proper Fix (Combine Orders)
1. In Shopify, **edit** the original order
2. Increase the total to the full amount
3. Mark the deposit as a partial payment
4. Send second invoice for remaining amount

---

## Testing Webhooks with Partial Payments

### Test Scenario

1. Create a test order for $100
2. Send invoice for $50 (50% deposit)
3. Mark as paid (use "Mark as paid" in admin)
4. Check your Custom Ops system:
   - Should show: `shopify_financial_status: "partially_paid"`
   - Should show: `status: "deposit_paid_ready_for_batch"`

5. Send invoice for remaining $50
6. Mark as paid
7. Check your Custom Ops system:
   - Should show: `shopify_financial_status: "paid"`
   - Should show: `status: "paid_ready_for_batch"`

---

## Summary

### ✅ DO THIS:
- Create ONE order for full amount
- Collect partial payments on that same order
- Webhooks update automatically
- Clear audit trail

### ❌ DON'T DO THIS:
- Create separate orders for deposit vs final
- Manually update statuses every time
- Lose automatic webhook updates

---

## Questions?

**"What if I already sent the deposit invoice as a separate order?"**
- For existing orders, manually update the status
- For future orders, use the recommended method above

**"Can I still batch orders that only have deposit paid?"**
- Yes! Status `deposit_paid_ready_for_batch` means deposit is sufficient for production
- Final payment can be collected before/after shipping (your choice)

**"What if the customer wants Net 30 payment terms?"**
- Still create one order for full amount
- Mark as paid when deposit received: `partially_paid`
- When final payment received (30 days later): `paid`
- Webhooks handle it automatically

**"How do I know if an order is deposit vs fully paid?"**
- Check `shopify_financial_status`:
  - `partially_paid` = Deposit only
  - `paid` = Fully paid
- Webhooks keep this synced automatically
