# Import Historical Orders

## Overview

You can import old Customify and Custom Design Service orders from Shopify into Custom Ops.

---

## Setup

### 1. Add Shopify Credentials to Environment

Add these to `.env.local`:

```bash
# Shopify Store Domain (without https://)
SHOPIFY_STORE_DOMAIN=your-store.myshopify.com

# Shopify Admin API Access Token
SHOPIFY_ADMIN_API_TOKEN=shpat_xxxxxxxxxxxxx
```

### 2. Get Shopify Admin API Token

1. Go to Shopify Admin → Settings → Apps and sales channels
2. Click **Develop apps**
3. Create new app (e.g., "Custom Ops Import")
4. Configure **Admin API access scopes**:
   - ✅ `read_orders`
5. Install app to your store
6. Copy **Admin API access token**
7. Paste into `.env.local`

---

## Usage

### Option 1: Import by Date Range (Recommended)

Import all custom orders from a date range:

```bash
curl -X POST http://localhost:3000/api/shopify/import-orders \
  -H "Content-Type: application/json" \
  -d '{
    "startDate": "2024-01-01T00:00:00Z",
    "endDate": "2024-12-31T23:59:59Z"
  }'
```

**Response:**
```json
{
  "total": 150,
  "imported": 45,
  "skipped": 105,
  "errors": []
}
```

- **total**: Total orders fetched from Shopify
- **imported**: Custom orders successfully imported
- **skipped**: Non-custom orders or duplicates
- **errors**: Any errors encountered

### Option 2: Import Specific Orders

Import specific order IDs:

```bash
curl -X POST http://localhost:3000/api/shopify/import-orders \
  -H "Content-Type: application/json" \
  -d '{
    "orderIds": ["6510", "6539", "6789"]
  }'
```

### Option 3: Import All Recent Orders

Import last 3 months:

```bash
curl -X POST http://localhost:3000/api/shopify/import-orders \
  -H "Content-Type: application/json" \
  -d '{
    "startDate": "2024-10-01T00:00:00Z"
  }'
```

---

## What Gets Imported

### Customify Orders
- ✅ Work item created with status `approved` (already fulfilled)
- ✅ All Customify file URLs extracted and linked
- ✅ Customer info, quantity, grip color
- ✅ Shopify order ID linked

### Custom Design Service Orders
- ✅ Work item created with type `assisted_project`
- ✅ Status set to `design_fee_paid`
- ✅ Customer info from order

### What Doesn't Get Imported
- ❌ Regular orders (no Customify or Custom Design Service)
- ❌ Orders already in the system (duplicates skipped)

---

## Production Usage

Once deployed to Vercel, use the production URL:

```bash
curl -X POST https://your-app.vercel.app/api/shopify/import-orders \
  -H "Content-Type: application/json" \
  -d '{
    "startDate": "2024-01-01T00:00:00Z"
  }'
```

---

## Troubleshooting

### Error: "Shopify API error: 401 Unauthorized"

- Check `SHOPIFY_ADMIN_API_TOKEN` is correct
- Verify token has `read_orders` scope
- Ensure app is installed to store

### Error: "SHOPIFY_STORE_DOMAIN is not defined"

- Add environment variable to `.env.local`
- Restart dev server: `npm run dev`
- For production: Add to Vercel environment variables

### No Orders Imported (all skipped)

- Orders may not have Customify properties
- Check order tags for "customify" or "custom design"
- Verify date range includes custom orders

### Some Orders Have Errors

- Check response `errors` array for details
- Common issues: missing customer email, invalid data

---

## Example Workflow

**Import last year's orders:**

1. Add Shopify credentials to `.env.local`
2. Restart dev server
3. Run import:
   ```bash
   curl -X POST http://localhost:3000/api/shopify/import-orders \
     -H "Content-Type: application/json" \
     -d '{
       "startDate": "2024-01-01T00:00:00Z",
       "endDate": "2024-12-31T23:59:59Z"
     }'
   ```
4. Check response for results
5. Navigate to Work Items in Custom Ops
6. Verify imported orders appear

---

## Rate Limits

Shopify API has rate limits:
- **Standard**: 2 requests/second
- **Plus**: 4 requests/second

The import endpoint fetches up to 250 orders at a time. For large imports:
- Split into smaller date ranges
- Wait between requests
- Monitor Shopify API usage in Shopify Admin

---

## Advanced: UI for Import (Future)

You can add an admin page to trigger imports via UI:

**File**: `app/(dashboard)/admin/import/page.tsx`

```tsx
'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card } from '@/components/ui/card'

export default function ImportPage() {
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<any>(null)
  const [startDate, setStartDate] = useState('2024-01-01')
  const [endDate, setEndDate] = useState('2024-12-31')

  const handleImport = async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/shopify/import-orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          startDate: `${startDate}T00:00:00Z`,
          endDate: `${endDate}T23:59:59Z`,
        }),
      })
      const data = await res.json()
      setResult(data)
    } catch (error) {
      console.error(error)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-3xl font-bold">Import Historical Orders</h1>

      <Card className="p-6">
        <div className="space-y-4">
          <div>
            <label>Start Date</label>
            <Input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
            />
          </div>
          <div>
            <label>End Date</label>
            <Input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
            />
          </div>
          <Button onClick={handleImport} disabled={loading}>
            {loading ? 'Importing...' : 'Import Orders'}
          </Button>
        </div>
      </Card>

      {result && (
        <Card className="p-6">
          <h2 className="font-bold mb-4">Results</h2>
          <div className="space-y-2">
            <p>Total orders fetched: {result.total}</p>
            <p className="text-green-600">Imported: {result.imported}</p>
            <p className="text-gray-600">Skipped: {result.skipped}</p>
            {result.errors?.length > 0 && (
              <div>
                <p className="text-red-600">Errors: {result.errors.length}</p>
                <ul className="text-sm text-red-600 mt-2">
                  {result.errors.map((err: string, i: number) => (
                    <li key={i}>{err}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </Card>
      )}
    </div>
  )
}
```

---

## Security Notes

- Import endpoint is unauthenticated (add auth if exposing to production)
- Admin API token has full access - keep secure
- Consider adding IP whitelisting for import endpoint
- Rate limit the import endpoint to prevent abuse

---

Need help? Check Shopify order data in Admin to verify custom properties exist!
