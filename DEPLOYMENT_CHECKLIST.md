# Deployment Checklist - Make System Operational

**Goal**: Get system from 60% to 100% functional

---

## ⚠️ CRITICAL - Do These FIRST (15 minutes total)

### 1. Run Database Migration for Customer CRM Fields

**Why**: Customer list columns are empty without these fields

**Steps**:
1. Open Supabase Dashboard → SQL Editor
2. Copy contents of `migrations/add_customer_crm_fields.sql`
3. Paste and execute
4. Verify with:
   ```sql
   SELECT column_name, data_type
   FROM information_schema.columns
   WHERE table_name = 'customers'
   AND column_name IN ('assigned_to_user_id', 'organization_name', 'estimated_value', 'next_follow_up_at')
   ORDER BY column_name;
   ```
5. Should see 4 rows returned

**Impact if skipped**: Customer list Assigned To, Company, Est. Value, Next Follow-Up columns will be empty

---

### 2. Create Supabase Storage Bucket for Files

**Why**: File uploads will fail without this bucket

**Steps**:
1. Open Supabase Dashboard → Storage
2. Click "Create bucket"
3. Name: `files`
4. Public bucket: **YES** (for downloads)
5. Click Create

**Set up RLS policies**:
```sql
-- Allow authenticated users to upload files
CREATE POLICY "Authenticated users can upload files"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'files');

-- Allow authenticated users to read files  
CREATE POLICY "Authenticated users can read files"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'files');

-- Allow authenticated users to delete their uploaded files
CREATE POLICY "Users can delete their own files"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'files' AND auth.uid() = owner);
```

**Impact if skipped**: File upload feature completely broken

---

## 🔴 HIGH PRIORITY - Core Functionality (1-2 days)

### 3. Build Email Composer
### 4. Build Create Customer Form
### 5. Build Create Project Form

See OPERATIONAL_READINESS_CHECKLIST.md for details

---

## 🟡 MEDIUM PRIORITY - Polish (2-4 hours)

### 6. Fix Customer Files Tab (30 min)
### 7. Complete All Projects Page Columns (1-2 hours)
### 8. Add Designer Assignment (1-2 hours)

---

## 📊 Summary

**To Get Fully Operational**: 1-2 days
**Current Progress**: 60% functional
**After Critical Items**: System ready for daily use
