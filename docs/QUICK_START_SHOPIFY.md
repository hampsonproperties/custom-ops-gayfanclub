# Quick Start: Shopify Integration

Everything you need to know about your Shopify integration and payment workflow.

## ✅ What We Just Set Up

### 1. Shopify Webhooks (Automatic Updates)
- ✅ **orders/create** - New orders flow in automatically
- ✅ **orders/updated** - Payment status updates automatically
- ✅ **orders/fulfilled** - Fulfillment status syncs automatically

**Webhook URL:** `https://custom-ops-gayfanclub.vercel.app/api/webhooks/shopify`
**API Version:** 2026-01 (Latest)
**Security:** Webhook secret configured in Vercel

### 2. Order #6540 Fixed
- Status: `deposit_paid_ready_for_batch`
- Shopify shows "paid" because the $1,000 deposit invoice is fully paid
- System knows it's only 50% paid and final $1,000 is still due

---

## 🎯 Your New Workflow (For Future Orders)

### Creating Orders with Deposit Payments

**Step 1: Create Order for FULL Amount**
1. In Shopify Admin → Orders → Create order
2. Customer: Enter customer info
3. Add products: 200 fans @ $10/each = **$2,000**
4. Save order (don't send invoice yet)

**Step 2: Send Deposit Invoice (50%)**
1. Open the order
2. Click **"Collect payment"** or **"Send invoice"**
3. Enter amount: **$1,000** (50% deposit)
4. Send to customer

**Step 3: Customer Pays Deposit**
- Customer pays $1,000
- Shopify updates order to: `financial_status: "partially_paid"`
- **Webhook automatically updates Custom Ops to:** `deposit_paid_ready_for_batch` ✅
- Order appears in your system ready to batch!

**Step 4: Add to Print Batch**
- Order now shows in Custom Ops with deposit paid
- You can add it to a print batch
- Production can start (deposit covers costs)

**Step 5: Send Final Invoice (When Ready)**
1. When ready to ship (or per your terms)
2. Go back to the same order in Shopify
3. Click **"Collect payment"** again
4. Send invoice for remaining **$1,000**

**Step 6: Customer Pays Final**
- Customer pays remaining $1,000
- Shopify updates to: `financial_status: "paid"`
- **Webhook automatically updates Custom Ops to:** `paid_ready_for_batch` ✅
- Ready to ship!

---

## 📊 Status Meanings

| Shopify Status | Custom Ops Status | What It Means |
|---------------|-------------------|---------------|
| `pending` | `invoice_sent` | Invoice sent, no payment yet |
| `partially_paid` | `deposit_paid_ready_for_batch` | Deposit paid (50%), can batch for production |
| `paid` | `paid_ready_for_batch` | Fully paid (100%), ready to batch/ship |

---

## ⚠️ Important: Don't Create Separate Orders

**❌ DON'T DO THIS:**
- Order #6540: $1,000 (deposit) ← Separate order
- Order #6541: $1,000 (final) ← Another separate order

**Why?** Both will show as "paid" and webhooks can't tell them apart.

**✅ DO THIS INSTEAD:**
- Order #6540: $2,000 (full amount)
- Collect $1,000 (partial payment #1)
- Collect $1,000 (partial payment #2)

**Why?** Webhooks see `partially_paid` → `paid` and update automatically!

---

## 🧪 Testing Your Setup

### Test Partial Payment Flow

1. **Create a test order:**
   - Product: Custom fans
   - Quantity: 10
   - Total: $100

2. **Send deposit invoice:**
   - Click "Collect payment"
   - Amount: $50
   - Send invoice

3. **Mark as paid (for testing):**
   - Click "Mark as paid"
   - Amount: $50

4. **Check Custom Ops:**
   - Should show: `shopify_financial_status: "partially_paid"`
   - Should show: `status: "deposit_paid_ready_for_batch"`
   - ✅ Webhook worked!

5. **Send final invoice:**
   - Click "Collect payment" again
   - Amount: $50 (remaining)
   - Send invoice

6. **Mark final as paid:**
   - Click "Mark as paid"
   - Amount: $50

7. **Check Custom Ops again:**
   - Should show: `shopify_financial_status: "paid"`
   - Should show: `status: "paid_ready_for_batch"`
   - ✅ Webhook worked again!

---

## 🔍 Checking Webhooks Are Working

### Option 1: Check in Shopify
1. Shopify Admin → Settings → Notifications
2. Scroll to **Webhooks**
3. Click on any webhook
4. Check **"Recent deliveries"**
5. Should show HTTP 200 (success) responses

### Option 2: Check Your Database
Run this command:
```bash
npm run check:webhooks-6540
```

Should show webhook events being logged and processed.

### Option 3: Check Vercel Logs
1. Vercel Dashboard → Your Project
2. Click **Functions**
3. Click `/api/webhooks/shopify`
4. See recent invocations

---

## 📝 For Existing Orders (Like #6540)

If you already created separate invoices:

**Short-term fix:**
- Manually note that it's deposit-only
- Status is already set to `deposit_paid_ready_for_batch`
- When you get final payment, manually update if needed

**Long-term:**
- Use the new workflow (ONE order, partial payments) for all future orders
- Webhooks will handle everything automatically

---

## 💡 Pro Tips

**Payment Terms:**
- If you have Shopify Plus, use "Payment Terms" feature
- Set up: "50% due now, 50% due on delivery"
- Even more automatic!

**Draft Orders:**
- Use draft orders to quote customers
- Convert to real order when approved
- Then use the partial payment workflow above

**Tracking:**
- All payment history is in the Shopify order
- Easy to see deposit vs final payment
- Clear audit trail for both you and customer

---

## 🆘 Troubleshooting

**"Webhook not updating my order"**
1. Check Shopify webhook "Recent deliveries" for errors
2. Check Vercel function logs for errors
3. Verify webhook secret matches in Vercel environment variables
4. Make sure you redeployed after adding the secret

**"Order shows as 'paid' but should be partially paid"**
- You might have created a separate deposit order
- Check the order total in Shopify
- If it's just the deposit amount, that's why it shows as "paid"
- Use the new workflow for future orders

**"Can't find 'Collect payment' button"**
- Order might be in Draft status
- Complete the draft order first, then you can collect payment

---

## 📚 More Info

See these docs for details:
- `docs/SHOPIFY_WEBHOOK_SETUP.md` - Complete webhook setup guide
- `docs/DEPOSIT_PAYMENT_WORKFLOW.md` - Detailed deposit payment workflow

---

## ✨ You're All Set!

Your Shopify integration is now:
- ✅ Automatically syncing orders
- ✅ Automatically updating payment status
- ✅ Ready for deposit payment workflow
- ✅ No manual status updates needed!

Just remember: **ONE order per customer, collect payments in parts** and webhooks handle the rest!
