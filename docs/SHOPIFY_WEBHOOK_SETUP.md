# Shopify Webhook Setup Guide

Complete step-by-step instructions for configuring Shopify webhooks to automatically sync order updates to Custom Ops.

## Prerequisites

- ✅ App deployed to Vercel (or your production URL)
- ✅ Shopify store with admin access
- ✅ Custom Ops app running and accessible

## Why You Need Webhooks

Without webhooks, your Custom Ops system won't automatically:
- Update when orders are paid or partially paid
- Know when orders are updated in Shopify
- Sync fulfillment status changes
- Reflect current payment status

**With webhooks configured**, your system automatically updates in real-time when:
- New orders are placed
- Payment status changes (pending → partially_paid → paid)
- Orders are fulfilled/shipped

---

## Step-by-Step Setup

### Step 1: Find Your Webhook URL

Your webhook endpoint is:
```
https://custom-ops-gayfanclub.vercel.app/api/webhooks/shopify
```

**Important:** This must be your production URL, not localhost. Shopify can't send webhooks to localhost.

### Step 2: Access Shopify Webhook Settings

1. Log into your **Shopify Admin**
2. Click **Settings** (bottom left corner)
3. Click **Notifications** in the settings menu
4. Scroll down to the **Webhooks** section at the bottom

### Step 3: Create "orders/create" Webhook

1. Click **Create webhook**
2. Fill in the form:
   - **Event:** Select `Order creation` from the dropdown
   - **Format:** Select `JSON`
   - **URL:** Enter `https://custom-ops-gayfanclub.vercel.app/api/webhooks/shopify`
   - **Webhook API version:** Select latest (2024-01 or newer)
3. Click **Save webhook**

### Step 4: Create "orders/updated" Webhook

**This is the most important one for payment status updates!**

1. Click **Create webhook** again
2. Fill in the form:
   - **Event:** Select `Order updated` from the dropdown
   - **Format:** Select `JSON`
   - **URL:** Enter `https://custom-ops-gayfanclub.vercel.app/api/webhooks/shopify`
   - **Webhook API version:** Select latest (2024-01 or newer)
3. Click **Save webhook**

### Step 5: Create "orders/fulfilled" Webhook

1. Click **Create webhook** again
2. Fill in the form:
   - **Event:** Select `Order fulfillment` from the dropdown
   - **Format:** Select `JSON`
   - **URL:** Enter `https://custom-ops-gayfanclub.vercel.app/api/webhooks/shopify`
   - **Webhook API version:** Select latest (2024-01 or newer)
3. Click **Save webhook**

### Step 6: Configure Webhook Secret (Security)

1. After creating your first webhook, Shopify will show you a **webhook signing secret**
2. Copy this secret (it looks like: `shpss_xxxxxxxxxxxxxxxxxxxxx`)
3. Add it to your Vercel environment variables:

#### In Vercel Dashboard:

1. Go to your project in Vercel
2. Click **Settings** → **Environment Variables**
3. Add a new variable:
   - **Name:** `SHOPIFY_WEBHOOK_SECRET`
   - **Value:** `shpss_xxxxxxxxxxxxxxxxxxxxx` (paste your secret)
   - **Environment:** Check all environments (Production, Preview, Development)
4. Click **Save**

5. **Important:** Redeploy your app for the new environment variable to take effect:
   - Go to **Deployments** tab
   - Click the three dots on the latest deployment
   - Click **Redeploy**

### Step 7: Verify Webhooks Are Active

Back in Shopify Admin → Settings → Notifications → Webhooks, you should see:

```
✅ Order creation          → https://custom-ops-gayfanclub.vercel.app/api/webhooks/shopify
✅ Order updated           → https://custom-ops-gayfanclub.vercel.app/api/webhooks/shopify
✅ Order fulfillment       → https://custom-ops-gayfanclub.vercel.app/api/webhooks/shopify
```

All should show as "Active" with green checkmarks.

---

## Testing Your Webhooks

### Method 1: Test a Real Order Update

1. Go to Shopify Admin → **Orders**
2. Find an existing custom order (like #6540)
3. Click **Collect Payment** or **Mark as Paid**
4. Within seconds, check your Custom Ops system:
   - The order's `shopify_financial_status` should update
   - Status should change to reflect payment (e.g., `paid_ready_for_batch`)

### Method 2: Check Webhook Delivery

1. In Shopify Admin → Settings → Notifications → Webhooks
2. Click on one of your webhooks
3. Scroll to **Recent deliveries** section
4. You should see successful deliveries (HTTP 200 responses)
5. Click **View details** to see the webhook payload and response

### Method 3: Check Your Database

Run this script to verify webhooks are being received:

```bash
npm run check:webhooks-6540
```

You should see webhook events logged in the `webhook_events` table.

---

## Troubleshooting

### ❌ Webhook shows "Failed" in Shopify

**Check 1: URL is correct**
- Must be exactly: `https://custom-ops-gayfanclub.vercel.app/api/webhooks/shopify`
- No trailing slash
- Must be HTTPS (not HTTP)

**Check 2: Endpoint is responding**
- Test in browser: your URL should return a message (not 404)
- Check Vercel logs for errors

**Check 3: HMAC verification**
- Make sure `SHOPIFY_WEBHOOK_SECRET` is set in Vercel
- Make sure you redeployed after adding the secret

### ❌ Webhooks not updating orders

**Check 1: Webhook events table**
```bash
npm run check:webhooks-6540
```

If no events are logged:
- Webhooks aren't being received
- Check Shopify "Recent deliveries" for failed attempts

If events show `processing_status: 'failed'`:
- Check the `processing_error` column for details
- Look at Vercel function logs for errors

**Check 2: Order detection logic**
Your webhook handler only processes custom orders. Check that orders have:
- "Customify" in product name, OR
- Custom properties, OR
- "Custom Design Service" product, OR
- "Bulk" in product title

### ❌ "HMAC verification failed" errors

1. Double-check your `SHOPIFY_WEBHOOK_SECRET` in Vercel matches Shopify
2. Make sure the secret is from the **same Shopify store**
3. Redeploy after updating the secret

### ❌ Partial payments not updating status

Make sure you created the **"Order updated"** webhook specifically. This is what fires when payment status changes.

---

## What Happens When a Webhook is Received

When Shopify sends an `orders/updated` webhook after a partial payment:

1. **Webhook received** at `/api/webhooks/shopify`
2. **HMAC verified** using your webhook secret
3. **Logged** to `webhook_events` table
4. **Processed** by the handler:
   - Checks if order exists in `work_items`
   - Updates `shopify_financial_status` to `"partially_paid"`
   - Updates `status` to `"deposit_paid_ready_for_batch"`
   - Creates a status event log
   - Auto-links recent emails from customer
5. **Marked complete** in webhook_events table

---

## Manual Order Sync (If Needed)

If webhooks weren't set up initially, existing orders won't have webhook history. You can:

### Option 1: Re-import a Single Order
```bash
# Create an API call to re-import
curl -X POST https://custom-ops-gayfanclub.vercel.app/api/shopify/import-single-order \
  -H "Content-Type: application/json" \
  -d '{"orderId": "8511409750322"}'
```

### Option 2: Bulk Re-import
Use the Shopify import feature in your Custom Ops admin UI to re-sync all orders.

---

## Maintenance

### Monitoring Webhook Health

Periodically check:
1. Shopify Admin → Webhooks → Recent deliveries (should show 200 responses)
2. Your `webhook_events` table (should have recent entries)
3. No failed webhooks piling up

### Updating Webhook URLs

If you change your deployment URL:
1. Update all 3 webhooks in Shopify
2. Update the webhook secret if it changes
3. Test with a dummy order

---

## Summary Checklist

- [ ] Created 3 webhooks in Shopify:
  - [ ] orders/create
  - [ ] orders/updated ← **Most important for payment updates**
  - [ ] orders/fulfilled
- [ ] All webhooks point to: `https://custom-ops-gayfanclub.vercel.app/api/webhooks/shopify`
- [ ] Format set to JSON
- [ ] Webhook secret added to Vercel environment variables
- [ ] App redeployed after adding secret
- [ ] Tested with a real order update
- [ ] Verified webhook deliveries in Shopify show success (200)
- [ ] Checked `webhook_events` table has entries

---

## Next Steps

Once webhooks are working:
1. ✅ Payment status updates automatically
2. ✅ New orders flow into system automatically
3. ✅ Fulfillment status syncs when you ship
4. ✅ No more manual status updates needed!

**Need help?** Check Vercel function logs or Shopify webhook delivery logs for error details.
