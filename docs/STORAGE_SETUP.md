# Supabase Storage Setup Guide

## Overview

The Custom Ops system uses Supabase Storage for file uploads (design proofs, final designs, previews, etc.) and also links to external files hosted on Customify's S3.

---

## Storage Bucket Setup

### 1. Create Storage Bucket

1. Go to your Supabase project dashboard
2. Navigate to **Storage** in the left sidebar
3. Click **New bucket**
4. Configure the bucket:
   - **Name**: `custom-ops-files`
   - **Public bucket**: ✅ Yes (checked)
   - **File size limit**: 50 MB (recommended)
   - **Allowed MIME types**: Leave empty for all types, or specify: `image/*,application/pdf`

5. Click **Create bucket**

### 2. Set Up Storage Policies

After creating the bucket, set up Row Level Security (RLS) policies for access control:

#### Policy 1: Allow Authenticated Users to Upload

```sql
CREATE POLICY "Authenticated users can upload files"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'custom-ops-files');
```

#### Policy 2: Allow Public Read Access

```sql
CREATE POLICY "Public read access"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'custom-ops-files');
```

#### Policy 3: Allow Authenticated Users to Delete

```sql
CREATE POLICY "Authenticated users can delete own files"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'custom-ops-files');
```

### 3. Alternative: Create via SQL

You can also create the bucket and policies via SQL Editor:

```sql
-- Create storage bucket
INSERT INTO storage.buckets (id, name, public)
VALUES ('custom-ops-files', 'custom-ops-files', true);

-- Create policies
CREATE POLICY "Authenticated users can upload files"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'custom-ops-files');

CREATE POLICY "Public read access"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'custom-ops-files');

CREATE POLICY "Authenticated users can delete files"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'custom-ops-files');
```

---

## File Organization

Files are organized in the bucket using this path structure:

```
custom-ops-files/
└── work-items/
    └── {work_item_id}/
        ├── proof-v1-design.png
        ├── proof-v2-design.png
        ├── design-v1-final.png
        └── preview-v1-mockup.jpg
```

---

## File Types and Sources

### Uploaded Files (Supabase Storage)

Files uploaded through the Custom Ops UI:
- **storage_bucket**: `custom-ops-files`
- **storage_path**: `work-items/{work_item_id}/{kind}-v{version}-{filename}`
- **kind**: `proof`, `design`, `preview`, `other`

### External Files (Customify S3)

Files linked from Customify orders:
- **storage_bucket**: `customify`
- **storage_path**: Full S3 URL (e.g., `https://customify-us-east.s3.amazonaws.com/...`)
- **kind**: Based on property name (`design`, `preview`, `other`)
- **note**: `"Imported from Customify"`

---

## Accessing Files

### In Code

```typescript
import { getFileUrl } from '@/lib/hooks/use-files'

const fileUrl = getFileUrl(file)
// Returns:
// - For Supabase files: Public URL from Supabase Storage
// - For Customify files: Direct S3 URL
```

### Public URLs

Supabase Storage public URLs follow this format:

```
https://{project-id}.supabase.co/storage/v1/object/public/custom-ops-files/{file-path}
```

---

## Testing Storage Setup

### Test Upload

1. Log in to Custom Ops
2. Navigate to any work item detail page
3. Click **Files** tab
4. Click **Upload File**
5. Select an image file
6. Choose file type (e.g., "Proof")
7. Click **Upload**

### Test Customify Import

1. Create a test Customify order in Shopify (or use webhook testing)
2. Include line item properties with design URLs:
   - `final design 1`: `https://customify-us-east.s3.amazonaws.com/...`
   - `design 1`: `https://customify-us-east.s3.amazonaws.com/...`
3. Trigger webhook to Custom Ops
4. Check work item's Files tab - should see imported Customify files

---

## Troubleshooting

### Upload Fails with "Permission Denied"

- Check that the storage bucket is public
- Verify RLS policies are created correctly
- Ensure user is authenticated

### Files Not Displaying

- Check browser console for CORS errors
- Verify bucket name is correct in code (`custom-ops-files`)
- Check that files exist in Supabase Storage dashboard

### Customify Files Not Importing

- Verify webhook is receiving order data
- Check that line item properties include URLs
- Look in webhook_events table for processing errors

---

## Storage Limits

Supabase Free Tier:
- **Storage**: 1 GB
- **Bandwidth**: 2 GB/month

Supabase Pro Tier:
- **Storage**: 100 GB included (then $0.021/GB)
- **Bandwidth**: 250 GB included (then $0.09/GB)

Monitor usage in Supabase dashboard under **Settings > Billing > Usage**.

---

## Security Notes

- Files are publicly accessible via URL (required for displaying in UI)
- Row Level Security prevents unauthorized uploads/deletes
- File uploads are limited to authenticated users only
- Consider adding virus scanning for production (Supabase Add-on)
- External Customify URLs are not stored in Supabase Storage (just linked)

---

## Cleanup

To delete the bucket and all files:

```sql
-- Delete all policies first
DROP POLICY IF EXISTS "Authenticated users can upload files" ON storage.objects;
DROP POLICY IF EXISTS "Public read access" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can delete files" ON storage.objects;

-- Delete bucket
DELETE FROM storage.buckets WHERE id = 'custom-ops-files';
```

**Warning**: This permanently deletes all uploaded files!
