# Shopify Integration Enhancement - Quick Deployment Checklist

**Date:** February 26, 2026
**Features:** Customer Notes/Tags Sync, Multi-Order Architecture, Bi-Directional Sync

---

## ☑️ Quick Checklist

### 1. Database [ ]
```bash
cd custom-ops
supabase db push
supabase gen types typescript --local > types/supabase.ts
```

**Verify 3 migrations applied:**
- `20260226000001_shopify_notes_sync.sql`
- `20260226000002_multi_order_architecture.sql`
- `20260226000003_bidirectional_sync.sql`

### 2. Environment Variables [ ]
```bash
# Add to Vercel
CRON_SECRET="<openssl rand -base64 32>"

# Verify existing
SHOPIFY_SHOP_URL=...
SHOPIFY_ACCESS_TOKEN=...
SHOPIFY_WEBHOOK_SECRET=...
```

### 3. Vercel Cron Config [ ]
Create/update `vercel.json`:
```json
{
  "crons": [{
    "path": "/api/cron/process-shopify-sync",
    "schedule": "*/5 * * * *"
  }]
}
```

### 4. Deploy [ ]
```bash
git add .
git commit -m "feat: Shopify integration enhancement (phases 1-3)"
git push
```

### 5. Register Webhooks [ ]
```bash
# Create temp endpoint or run script
curl -X POST https://your-app.vercel.app/api/shopify/webhooks/register
```

**Or manually add in Shopify Admin:**
- `customers/create` → `https://your-app/api/webhooks/shopify`
- `customers/update` → `https://your-app/api/webhooks/shopify`
- `refunds/create` → `https://your-app/api/webhooks/shopify`

### 6. Test [ ]
**Inbound (Shopify → App):**
- [ ] Create test order with customer note
- [ ] Add customer tags (VIP, test)
- [ ] Verify in `work_item_notes`, `customer_orders`, `customers`

**Outbound (App → Shopify):**
- [ ] Queue note sync: `POST /api/shopify/sync/notes`
- [ ] Wait 5 min or trigger cron manually
- [ ] Verify in Shopify customer.note

### 7. Monitor [ ]
```sql
-- Check sync queue
SELECT status, COUNT(*) FROM shopify_sync_queue GROUP BY status;

-- Check webhooks
SELECT processing_status, COUNT(*) FROM webhook_events
WHERE received_at > NOW() - INTERVAL '24 hours'
GROUP BY processing_status;

-- Check customers
SELECT COUNT(*) FROM customers;
SELECT COUNT(*) FROM customer_orders;
```

---

## 📋 Quick SQL Tests

```sql
-- 1. Verify new tables exist
SELECT table_name FROM information_schema.tables
WHERE table_schema = 'public'
AND table_name IN ('customers', 'customer_orders', 'shopify_sync_queue', 'shopify_tag_mappings');
-- Should return 4 rows

-- 2. Check work_items.payment_history exists
SELECT column_name FROM information_schema.columns
WHERE table_name = 'work_items' AND column_name = 'payment_history';
-- Should return 1 row

-- 3. Check work_item_notes enhanced
SELECT column_name FROM information_schema.columns
WHERE table_name = 'work_item_notes' AND column_name IN ('source', 'external_id', 'synced_at');
-- Should return 3 rows
```

---

## 🚨 If Things Go Wrong

**Rollback code:**
```bash
git revert HEAD
git push
```

**Rollback database:** See `SHOPIFY_INTEGRATION_COMPLETE.md` section "Rollback Plan"

---

## ✅ Success Criteria

- [ ] No build/TypeScript errors
- [ ] Webhooks processing (check logs)
- [ ] Customer notes syncing from Shopify
- [ ] Customer tags syncing from Shopify
- [ ] Payment history populated
- [ ] Customer orders created
- [ ] Sync queue processing every 5 min
- [ ] Outbound syncs working (manually test)
- [ ] No errors in Vercel logs for 1 hour

---

**Deployed By:** _________________
**Date:** _________________
**Verified:** [ ] Yes [ ] No

**See `SHOPIFY_INTEGRATION_COMPLETE.md` for full documentation**
