# Files & Custom Design Implementation Summary

## What's Been Built ✅

### 1. Files System (Complete)

**New Files Created**:
- `/lib/hooks/use-files.ts` - Data hooks for file operations
- `/docs/STORAGE_SETUP.md` - Storage configuration guide
- `/docs/CUSTOM_DESIGN_WORKFLOW.md` - Workflow documentation

**Updated Files**:
- `/app/(dashboard)/work-items/[id]/page.tsx` - Added Files tab with upload UI
- `/app/api/webhooks/shopify/route.ts` - Extracts Customify URLs and handles Custom Design Service orders

**Features**:
- ✅ Files tab in work item detail page
- ✅ Drag-and-drop file upload dialog
- ✅ Grid view of files with thumbnails
- ✅ Auto-versioning (v1, v2, v3...)
- ✅ Support for multiple file types (proof, design, preview, other)
- ✅ Download/View buttons
- ✅ Delete uploaded files
- ✅ Customify file import from Shopify webhooks
- ✅ External URL support (Customify S3)

### 2. Custom Design Service Workflow (Complete)

**Updated Shopify Webhook**:
- ✅ Detects "Professional Custom Fan Design Service & Credit" product
- ✅ Finds existing work item by customer email
- ✅ Updates status to `design_fee_paid` when payment received
- ✅ Creates new work item if no existing inquiry found
- ✅ Extracts all Customify file URLs (final design, design, original images, preview)
- ✅ Creates file records for Customify URLs

**Supported Flows**:
```
Flow 1: Email → Pay → Design
Email Inquiry → Create Lead → Send Fee Link →
Customer Pays → Webhook Links Order → Design & Iterate

Flow 2: Pay → Design (Direct)
Customer Pays Design Fee → Webhook Creates Work Item →
Design & Iterate
```

---

## Setup Steps Required

### 1. Create Supabase Storage Bucket (5 min)

**Option A: Via Dashboard**
1. Go to Supabase → Storage
2. Click "New bucket"
3. Name: `custom-ops-files`
4. Public: ✅ Yes
5. Create bucket
6. Apply RLS policies (see `STORAGE_SETUP.md`)

**Option B: Via SQL** (Copy from `STORAGE_SETUP.md`)

### 2. No Other Changes Needed!

The database schema already supports everything:
- ✅ `files` table exists
- ✅ `assisted_project` type with full status flow
- ✅ Work item email matching
- ✅ File versioning

---

## How to Test

### Test 1: File Upload (Manual)

1. Run `npm run dev`
2. Navigate to any work item detail page
3. Click **Files** tab
4. Click **Upload File**
5. Select an image
6. Choose type "Proof"
7. Upload
8. ✅ File should appear in grid with thumbnail

### Test 2: Customify Import (Webhook)

**Simulate a Customify order**:

```sql
-- Insert test webhook event
INSERT INTO webhook_events (
  provider, event_type, external_event_id, payload, processing_status
) VALUES (
  'shopify',
  'orders/create',
  'test-customify-order-123',
  '{
    "id": 7654321,
    "name": "#7777",
    "customer": {
      "email": "test@example.com",
      "first_name": "Test",
      "last_name": "Customer"
    },
    "financial_status": "paid",
    "line_items": [{
      "title": "Custom Fan Designer",
      "quantity": 1,
      "properties": [
        {"name": "customify_note", "value": "test"},
        {"name": "final design 1", "value": "https://customify-us-east.s3.amazonaws.com/test1.png"},
        {"name": "design 1", "value": "https://customify-us-east.s3.amazonaws.com/test2.png"},
        {"name": "Preview", "value": "https://houston-fan-club.myshopify.com/preview"}
      ]
    }]
  }'::jsonb,
  'received'
);
```

Then call reprocess endpoint:
```bash
curl -X POST http://localhost:3000/api/webhooks/reprocess
```

✅ Should create work item with 3 file records (Customify URLs)

### Test 3: Custom Design Service Order

```sql
-- Insert Custom Design Service order webhook
INSERT INTO webhook_events (
  provider, event_type, external_event_id, payload, processing_status
) VALUES (
  'shopify',
  'orders/create',
  'test-design-service-123',
  '{
    "id": 8888888,
    "name": "#8888",
    "customer": {
      "email": "sarah@example.com",
      "first_name": "Sarah",
      "last_name": "Johnson"
    },
    "financial_status": "paid",
    "line_items": [{
      "title": "Professional Custom Fan Design Service & Credit",
      "quantity": 1,
      "price": "35.00"
    }]
  }'::jsonb,
  'received'
);
```

**Test Scenario A**: With Existing Inquiry

1. First create work item via Email Intake:
   - Email from sarah@example.com
   - Create Lead → Status: `new_inquiry`
2. Trigger webhook above
3. ✅ Should UPDATE existing work item:
   - Links Shopify order #8888
   - Changes status to `design_fee_paid`

**Test Scenario B**: Without Existing Inquiry

1. Trigger webhook (no existing work item for sarah@example.com)
2. ✅ Should CREATE new work item:
   - Type: `assisted_project`
   - Status: `design_fee_paid`

---

## UI Flow Demonstration

### Work Item Detail - Files Tab

```
┌─────────────────────────────────────────────────┐
│ Timeline | Communication | Files (3) | Details  │
├─────────────────────────────────────────────────┤
│                                                  │
│  [Upload File]                                  │
│                                                  │
│  ┌───────┐  ┌───────┐  ┌───────┐               │
│  │ IMG   │  │ IMG   │  │ IMG   │               │
│  │       │  │       │  │       │               │
│  └───────┘  └───────┘  └───────┘               │
│  final-design proof-v1  proof-v2               │
│  design      (We uploaded) (We uploaded)        │
│  (Customify)                                    │
│  [View]      [View] [Delete] [View] [Delete]   │
│                                                  │
└─────────────────────────────────────────────────┘
```

### Upload Dialog

```
┌─────────────────────────────────────────────────┐
│ Upload File                                  [×]│
├─────────────────────────────────────────────────┤
│                                                  │
│ File                                             │
│ [Choose File] design-proof.png selected         │
│                                                  │
│ File Type                                        │
│ [▼ Proof (Design we created)        ]          │
│                                                  │
│ Note (Optional)                                  │
│ ┌────────────────────────────────────────────┐ │
│ │ First proof based on customer requirements │ │
│ └────────────────────────────────────────────┘ │
│                                                  │
│              [Cancel]  [Upload]                 │
└─────────────────────────────────────────────────┘
```

---

## Architecture Notes

### File Storage Strategy

**Two Storage Providers**:
1. **Supabase Storage** (`storage_bucket = 'custom-ops-files'`)
   - Files uploaded through Custom Ops UI
   - Organized: `work-items/{id}/proof-v1-{filename}`
   - Auto-versioning by file kind

2. **External/Customify** (`storage_bucket = 'customify'`)
   - Imported from Shopify line item properties
   - `storage_path` = full S3 URL
   - Read-only (no delete button)

### File URL Resolution

```typescript
function getFileUrl(file: File): string {
  if (file.storage_bucket === 'customify' || file.storage_bucket === 'external') {
    return file.storage_path // Direct URL
  }
  return supabase.storage.from(file.storage_bucket).getPublicUrl(file.storage_path)
}
```

### Version Auto-Increment

When uploading:
1. Query existing files for same `work_item_id` + `kind`
2. Find max version number
3. New file version = max + 1
4. Filename: `{kind}-v{version}-{original_name}`

---

## What's NOT Included (Future Enhancements)

These were discussed but not built in this phase:

- ❌ Custom Design Queue page (dedicated view)
- ❌ "Ball possession" indicator component
- ❌ Dashboard stat card for Custom Designs
- ❌ Navigation link to Custom Design Queue
- ❌ Automatic draft order creation
- ❌ Link to Order button (manual linking)

**Why?** You can manage Custom Design projects through:
- Existing Work Items list (filter by type: `assisted_project`)
- Work Item detail page (Timeline, Communication, Files all work)
- Existing status badges show current state

**When to build Custom Design Queue page?**
- After testing the workflow end-to-end
- If you find yourself needing a grouped view (designing vs customer review)
- ~30 min to build using Design Queue as template

---

## Key Files Reference

**Frontend**:
- `app/(dashboard)/work-items/[id]/page.tsx` - Work item detail with Files tab
- `lib/hooks/use-files.ts` - File operations hooks
- `components/ui/*` - shadcn components (Dialog, Input, Textarea, etc.)

**Backend**:
- `app/api/webhooks/shopify/route.ts` - Webhook processor
- `supabase/migrations/20260127000001_initial_schema.sql` - Files table schema

**Types**:
- `types/database.ts` - File type definitions

**Documentation**:
- `docs/STORAGE_SETUP.md` - Supabase Storage setup
- `docs/CUSTOM_DESIGN_WORKFLOW.md` - Workflow guide
- `docs/FILES_AND_CUSTOM_DESIGN_SUMMARY.md` - This file

---

## Production Checklist

Before going live:

- [ ] Create Supabase Storage bucket `custom-ops-files`
- [ ] Apply RLS policies to storage bucket
- [ ] Test file upload with real image
- [ ] Test Customify order webhook (real order or staging)
- [ ] Test Custom Design Service order (real or staging)
- [ ] Configure Shopify webhook URL to point to production
- [ ] Set `SHOPIFY_WEBHOOK_SECRET` env variable
- [ ] Monitor webhook_events table for processing errors
- [ ] Set up storage usage alerts (Supabase Dashboard)

---

## Support

Questions or issues?
- Check `webhook_events` table for processing errors
- Check browser console for upload errors
- Verify Supabase Storage bucket exists and is public
- Review `STORAGE_SETUP.md` for troubleshooting

---

Built with 🌈 for The Gay Fan Club
Files system + Custom Design workflow complete!
