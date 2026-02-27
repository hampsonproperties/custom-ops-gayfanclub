# Data Cleanup & System Realignment Plan

**Date**: 2026-02-27
**Status**: Planning Phase

---

## 🎯 Objectives

1. Clean and re-import customer data correctly
2. Preserve batches (they're correct)
3. Link all emails to customers automatically
4. Fix Customify orders image display
5. Implement file gallery/preview view
6. Verify and fix Shopify integration

---

## 📋 Phase 1: Data Audit & Backup

### Step 1.1: Audit Current Data

**What's Working** ✅:
- Batches (keep these)
- Batch history since you took over

**What Needs Fixing** ❌:
- Customers data
- Projects data
- Customer-email linkages
- Shopify order assignments

### Step 1.2: Create Full Backup

```sql
-- Backup batches (KEEP THESE)
CREATE TABLE batches_backup AS SELECT * FROM batches;
CREATE TABLE batch_items_backup AS SELECT * FROM batch_items;

-- Backup for reference (will be replaced)
CREATE TABLE customers_backup AS SELECT * FROM customers;
CREATE TABLE work_items_backup AS SELECT * FROM work_items;
CREATE TABLE communications_backup AS SELECT * FROM communications;
```

### Step 1.3: Identify Data Sources

**Primary Sources**:
1. **Shopify**: All orders, customer info, order history
2. **Email System**: All communications (keep these)
3. **Batches**: Production records (authoritative source)

**Data Flow**:
```
Shopify Orders → Customers
                → Projects (work_items)
                → Link to Batches

Emails → Link to Customers by email address
       → Link to Projects where possible

Batches → Link to Projects (already done correctly)
```

---

## 📋 Phase 2: Database Schema Preparation

### Step 2.1: Ensure Customers Table Has Required Fields

```sql
-- Check current customers schema
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'customers'
ORDER BY ordinal_position;

-- Add missing fields for CRM functionality
ALTER TABLE customers
ADD COLUMN IF NOT EXISTS assigned_to_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS organization_name TEXT,
ADD COLUMN IF NOT EXISTS estimated_value NUMERIC(10,2),
ADD COLUMN IF NOT EXISTS next_follow_up_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS sales_stage TEXT DEFAULT 'active_customer',
ADD COLUMN IF NOT EXISTS shopify_customer_id TEXT UNIQUE,
ADD COLUMN IF NOT EXISTS shopify_last_sync_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS total_order_count INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS total_spent NUMERIC(10,2) DEFAULT 0;

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_customers_shopify_id ON customers(shopify_customer_id);
CREATE INDEX IF NOT EXISTS idx_customers_assigned_to ON customers(assigned_to_user_id);
CREATE INDEX IF NOT EXISTS idx_customers_sales_stage ON customers(sales_stage);
```

### Step 2.2: Ensure Projects (work_items) Have Shopify Links

```sql
ALTER TABLE work_items
ADD COLUMN IF NOT EXISTS shopify_order_id TEXT,
ADD COLUMN IF NOT EXISTS shopify_order_number TEXT,
ADD COLUMN IF NOT EXISTS shopify_line_item_id TEXT;

CREATE INDEX IF NOT EXISTS idx_work_items_shopify_order ON work_items(shopify_order_id);
```

### Step 2.3: Ensure Communications Can Link to Customers

```sql
-- Already done in previous migration, but verify
ALTER TABLE communications
ADD COLUMN IF NOT EXISTS customer_id UUID REFERENCES customers(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_communications_customer
ON communications(customer_id)
WHERE customer_id IS NOT NULL;
```

---

## 📋 Phase 3: Shopify Integration Verification

### Step 3.1: Test Shopify API Connection

```typescript
// Test script: test-shopify-connection.ts
import { shopify } from '@/lib/shopify/client'

async function testShopifyConnection() {
  try {
    // Test basic connection
    const shop = await shopify.rest.Shop.all({ session })
    console.log('✅ Connected to Shopify:', shop.data[0].name)

    // Test customer fetch
    const customers = await shopify.rest.Customer.all({
      session,
      limit: 5
    })
    console.log('✅ Can fetch customers:', customers.data.length)

    // Test order fetch
    const orders = await shopify.rest.Order.all({
      session,
      limit: 5,
      status: 'any'
    })
    console.log('✅ Can fetch orders:', orders.data.length)

    return { success: true }
  } catch (error) {
    console.error('❌ Shopify connection failed:', error)
    return { success: false, error }
  }
}
```

### Step 3.2: Create Shopify Import Scripts

**File**: `scripts/import-from-shopify.ts`

```typescript
// Import all Shopify customers and orders
async function importFromShopify() {
  // Step 1: Import all customers
  console.log('Importing customers from Shopify...')
  const shopifyCustomers = await fetchAllShopifyCustomers()

  for (const shopifyCustomer of shopifyCustomers) {
    await upsertCustomer({
      email: shopifyCustomer.email,
      first_name: shopifyCustomer.first_name,
      last_name: shopifyCustomer.last_name,
      display_name: shopifyCustomer.first_name && shopifyCustomer.last_name
        ? `${shopifyCustomer.first_name} ${shopifyCustomer.last_name}`
        : shopifyCustomer.email,
      phone: shopifyCustomer.phone,
      shopify_customer_id: shopifyCustomer.id.toString(),
      organization_name: shopifyCustomer.company,
      total_order_count: shopifyCustomer.orders_count,
      total_spent: parseFloat(shopifyCustomer.total_spent),
      sales_stage: 'active_customer', // They've purchased before
      shopify_last_sync_at: new Date().toISOString()
    })
  }

  // Step 2: Import all orders as projects
  console.log('Importing orders from Shopify...')
  const shopifyOrders = await fetchAllShopifyOrders({
    status: 'any',
    limit: 250 // Adjust based on your needs
  })

  for (const order of shopifyOrders) {
    // Find or create customer
    const customer = await findCustomerByEmail(order.email)
    if (!customer) continue

    // Create work_item for each order
    await upsertWorkItem({
      customer_id: customer.id,
      title: `Order #${order.order_number}`,
      type: 'shopify_order',
      status: mapShopifyStatusToOurStatus(order.fulfillment_status),
      shopify_order_id: order.id.toString(),
      shopify_order_number: order.order_number.toString(),
      quantity: order.line_items.reduce((sum, item) => sum + item.quantity, 0),
      created_at: order.created_at,
      updated_at: order.updated_at
    })
  }

  console.log('✅ Shopify import complete')
}
```

---

## 📋 Phase 4: Email-to-Customer Linking

### Step 4.1: Link Existing Emails to Customers

```sql
-- Script to automatically link emails to customers by email address
UPDATE communications c
SET customer_id = customers.id
FROM customers
WHERE c.from_email = customers.email
  AND c.customer_id IS NULL;

-- Also link by "to" email for outbound emails
UPDATE communications c
SET customer_id = customers.id
FROM customers
WHERE c.to_email = customers.email
  AND c.customer_id IS NULL
  AND c.direction = 'outbound';

-- Report results
SELECT
  'Linked by from_email' as source,
  COUNT(*) as count
FROM communications
WHERE customer_id IS NOT NULL
GROUP BY 1

UNION ALL

SELECT
  'Still unlinked' as source,
  COUNT(*) as count
FROM communications
WHERE customer_id IS NULL;
```

### Step 4.2: Create Automatic Linking Trigger

```sql
-- Function to auto-link new emails to customers
CREATE OR REPLACE FUNCTION auto_link_email_to_customer()
RETURNS TRIGGER AS $$
BEGIN
  -- Try to find customer by from_email
  IF NEW.from_email IS NOT NULL THEN
    SELECT id INTO NEW.customer_id
    FROM customers
    WHERE email = NEW.from_email
    LIMIT 1;
  END IF;

  -- If not found and it's outbound, try to_email
  IF NEW.customer_id IS NULL AND NEW.direction = 'outbound' AND NEW.to_email IS NOT NULL THEN
    SELECT id INTO NEW.customer_id
    FROM customers
    WHERE email = NEW.to_email
    LIMIT 1;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger
DROP TRIGGER IF EXISTS trigger_auto_link_email ON communications;
CREATE TRIGGER trigger_auto_link_email
  BEFORE INSERT ON communications
  FOR EACH ROW
  EXECUTE FUNCTION auto_link_email_to_customer();
```

---

## 📋 Phase 5: File Gallery & Preview System

### Step 5.1: Database Schema for Files

```sql
-- Ensure files table has what we need
ALTER TABLE files
ADD COLUMN IF NOT EXISTS mime_type TEXT,
ADD COLUMN IF NOT EXISTS file_size_bytes BIGINT,
ADD COLUMN IF NOT EXISTS thumbnail_url TEXT,
ADD COLUMN IF NOT EXISTS is_image BOOLEAN GENERATED ALWAYS AS (
  mime_type LIKE 'image/%'
) STORED;

-- Index for quick image lookups
CREATE INDEX IF NOT EXISTS idx_files_is_image ON files(is_image) WHERE is_image = true;
```

### Step 5.2: File Gallery Component

**File**: `components/files/file-gallery.tsx`

```typescript
'use client'

import { useState } from 'react'
import Image from 'next/image'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent } from '@/components/ui/dialog'
import { Download, Maximize2, X } from 'lucide-react'

interface FileGalleryProps {
  files: Array<{
    id: string
    filename: string
    external_url: string
    mime_type: string
    file_size_bytes?: number
  }>
}

export function FileGallery({ files }: FileGalleryProps) {
  const [selectedImage, setSelectedImage] = useState<string | null>(null)

  const imageFiles = files.filter(f => f.mime_type?.startsWith('image/'))
  const otherFiles = files.filter(f => !f.mime_type?.startsWith('image/'))

  return (
    <div className="space-y-6">
      {/* Image Gallery */}
      {imageFiles.length > 0 && (
        <div>
          <h3 className="text-sm font-medium mb-3">Images ({imageFiles.length})</h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
            {imageFiles.map((file) => (
              <Card
                key={file.id}
                className="group relative aspect-square overflow-hidden cursor-pointer hover:ring-2 hover:ring-primary transition-all"
                onClick={() => setSelectedImage(file.external_url)}
              >
                <Image
                  src={file.external_url}
                  alt={file.filename}
                  fill
                  className="object-cover"
                  sizes="(max-width: 640px) 50vw, (max-width: 768px) 33vw, 25vw"
                />
                <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                  <Maximize2 className="h-6 w-6 text-white" />
                </div>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Other Files List */}
      {otherFiles.length > 0 && (
        <div>
          <h3 className="text-sm font-medium mb-3">Files ({otherFiles.length})</h3>
          <div className="space-y-2">
            {otherFiles.map((file) => (
              <Card key={file.id} className="p-3">
                <div className="flex items-center justify-between">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{file.filename}</p>
                    <p className="text-xs text-muted-foreground">
                      {file.mime_type} • {formatBytes(file.file_size_bytes)}
                    </p>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    asChild
                  >
                    <a href={file.external_url} download target="_blank" rel="noopener noreferrer">
                      <Download className="h-4 w-4" />
                    </a>
                  </Button>
                </div>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Image Lightbox */}
      <Dialog open={!!selectedImage} onOpenChange={() => setSelectedImage(null)}>
        <DialogContent className="max-w-4xl w-full h-[90vh] p-0">
          {selectedImage && (
            <div className="relative w-full h-full">
              <Image
                src={selectedImage}
                alt="Preview"
                fill
                className="object-contain"
                sizes="90vw"
              />
              <Button
                variant="ghost"
                size="icon"
                className="absolute top-4 right-4 bg-black/50 hover:bg-black/70 text-white"
                onClick={() => setSelectedImage(null)}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}

function formatBytes(bytes?: number) {
  if (!bytes) return 'Unknown size'
  const sizes = ['Bytes', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(1024))
  return `${(bytes / Math.pow(1024, i)).toFixed(2)} ${sizes[i]}`
}
```

---

## 📋 Phase 6: Customify Orders Image Display

### Step 6.1: Fix Customify Orders Query

```typescript
// File: app/(dashboard)/customify-orders/page.tsx

const { data: orders, isLoading, error } = useQuery({
  queryKey: ['customify-orders'],
  queryFn: async () => {
    const supabase = createClient()

    const { data, error } = await supabase
      .from('work_items')
      .select(`
        id,
        title,
        customer_id,
        quantity,
        event_date,
        deadline,
        design_review_status,
        proof_url,
        shopify_order_number,
        created_at,
        updated_at,
        customers (
          email,
          display_name,
          first_name,
          last_name
        ),
        files!inner (  /* Use !inner to ensure we only get work_items WITH files */
          id,
          external_url,
          filename,
          kind,
          mime_type,
          file_size_bytes,
          created_at
        )
      `)
      .eq('type', 'customify_order')
      .in('design_review_status', ['pending_review', 'needs_attention'])
      .order('created_at', { ascending: false })

    if (error) throw error

    return data || []
  },
})

// In the component render:
{orders?.map(order => (
  <Card key={order.id}>
    <CardHeader>
      <CardTitle>{order.title}</CardTitle>
      <CardDescription>
        {order.customers?.display_name || order.customers?.email}
      </CardDescription>
    </CardHeader>
    <CardContent>
      {/* Use FileGallery component */}
      <FileGallery files={order.files} />

      {/* Review controls */}
      <div className="mt-4 space-y-3">
        {/* Review checklist, approve/reject buttons */}
      </div>
    </CardContent>
  </Card>
))}
```

---

## 📋 Phase 7: Data Cleanup & Re-import Execution

### Step 7.1: Clean Current Data (CAREFUL!)

```sql
-- ONLY run this after backing up everything!
-- This is destructive!

BEGIN;

-- Keep batches and batch_items (they're correct)
-- Delete and re-import customers and projects

-- Save work_item IDs that are linked to batches (DON'T DELETE THESE)
CREATE TEMP TABLE work_items_in_batches AS
SELECT DISTINCT work_item_id
FROM batch_items
WHERE work_item_id IS NOT NULL;

-- Delete work_items NOT in batches
DELETE FROM work_items
WHERE id NOT IN (SELECT work_item_id FROM work_items_in_batches);

-- Delete all customers (will be re-imported from Shopify)
-- Note: This will cascade delete to work_items
DELETE FROM customers;

-- Unlink communications (we'll re-link them)
UPDATE communications SET customer_id = NULL, work_item_id = NULL;

COMMIT;
```

### Step 7.2: Run Shopify Import

```bash
# Run import script
npm run import:shopify

# Or manually:
ts-node scripts/import-from-shopify.ts
```

### Step 7.3: Re-link Emails

```sql
-- Run the email linking query from Phase 4
UPDATE communications c
SET customer_id = customers.id
FROM customers
WHERE c.from_email = customers.email
  AND c.customer_id IS NULL;

-- Report
SELECT COUNT(*) as linked_emails
FROM communications
WHERE customer_id IS NOT NULL;
```

### Step 7.4: Link Projects to Batches

```sql
-- Link work_items to batches via shopify_order_number
UPDATE work_items wi
SET batch_id = bi.batch_id
FROM batch_items bi
WHERE wi.shopify_order_number = bi.shopify_order_number
  AND wi.batch_id IS NULL
  AND bi.batch_id IS NOT NULL;
```

---

## 📋 Phase 8: Verification & Testing

### Step 8.1: Data Integrity Checks

```sql
-- Check 1: All customers have Shopify link
SELECT
  COUNT(*) FILTER (WHERE shopify_customer_id IS NOT NULL) as with_shopify,
  COUNT(*) FILTER (WHERE shopify_customer_id IS NULL) as without_shopify
FROM customers;

-- Check 2: Projects linked to customers
SELECT
  COUNT(*) FILTER (WHERE customer_id IS NOT NULL) as with_customer,
  COUNT(*) FILTER (WHERE customer_id IS NULL) as without_customer
FROM work_items;

-- Check 3: Emails linked to customers
SELECT
  COUNT(*) FILTER (WHERE customer_id IS NOT NULL) as linked,
  COUNT(*) FILTER (WHERE customer_id IS NULL) as unlinked
FROM communications;

-- Check 4: Batches intact
SELECT COUNT(*) FROM batches;
SELECT COUNT(*) FROM batch_items;

-- Check 5: Work items in batches preserved
SELECT
  wi.id,
  wi.title,
  wi.shopify_order_number,
  b.batch_number
FROM work_items wi
JOIN batch_items bi ON wi.id = bi.work_item_id
JOIN batches b ON bi.batch_id = b.id
ORDER BY b.created_at DESC
LIMIT 20;
```

### Step 8.2: UI Testing Checklist

- [ ] Customers page loads
- [ ] All columns show correct data (Name, Assigned, Company, Email, Phone, Value, Follow-Up)
- [ ] Customer detail page shows all projects
- [ ] Customer detail page shows all emails
- [ ] Customer detail page shows Shopify orders
- [ ] All Projects page loads
- [ ] Shows production-focused data
- [ ] Customify Orders page loads
- [ ] Customify Orders show images in gallery
- [ ] File gallery works (click to zoom)
- [ ] Can preview images without downloading

---

## 📊 Implementation Timeline

### Week 1: Preparation
- Day 1-2: Database schema updates
- Day 3: Shopify integration verification
- Day 4-5: Build import scripts

### Week 2: Data Migration
- Day 1: Full backup
- Day 2: Data cleanup
- Day 3: Shopify import
- Day 4: Email linking
- Day 5: Verification

### Week 3: UI Updates
- Day 1-2: Update Customers list
- Day 3-4: Transform All Projects page
- Day 5: File gallery implementation

### Week 4: Testing & Polish
- Day 1-3: Testing and bug fixes
- Day 4-5: Documentation and training

---

## ⚠️ Risks & Mitigation

### Risk 1: Data Loss During Cleanup
**Mitigation**: Full backups before any destructive operations, test on staging first

### Risk 2: Shopify API Rate Limits
**Mitigation**: Implement rate limiting, batch imports, retry logic

### Risk 3: Email Linking Mismatches
**Mitigation**: Manual review of unlinked emails, provide UI to manually link

### Risk 4: Broken Batch References
**Mitigation**: Preserve batch_items table, verify links before and after

---

## ✅ Success Criteria

### Data Quality
- [ ] 100% of customers linked to Shopify
- [ ] 95%+ of emails linked to customers
- [ ] All batches preserved and linked correctly
- [ ] No orphaned work items

### User Experience
- [ ] Customers page has all required CRM fields
- [ ] All Projects is production-focused
- [ ] File gallery works smoothly
- [ ] Images load without download
- [ ] No broken links or 404s

### Performance
- [ ] Customer list loads < 2 seconds
- [ ] File gallery renders < 1 second
- [ ] Image previews load progressively

---

**Next Steps**: Review this plan, approve phases, then execute Phase 1 (Data Audit & Backup).
