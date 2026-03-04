-- Verification Queries for PDR v3 Migrations
-- Run these in Supabase SQL editor to confirm migrations succeeded

-- 1. Check Email Ownership columns exist
SELECT COUNT(*) as emails_with_owners
FROM communications
WHERE owner_user_id IS NOT NULL;

-- 2. Check Proof Tracking columns exist
SELECT COUNT(*) as work_items_with_revisions
FROM work_items
WHERE revision_count > 0;

-- 3. Check Batch Drip Email columns exist
SELECT
  COUNT(*) as total_batches,
  COUNT(alibaba_order_number) as batches_with_alibaba_number
FROM batches;

-- 4. Check Email Templates were created
SELECT key, name, is_active
FROM templates
WHERE key LIKE 'drip_email%'
ORDER BY key;

-- 5. Verify all new columns on communications table
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'communications'
  AND column_name IN ('owner_user_id', 'priority', 'email_status')
ORDER BY column_name;

-- 6. Verify all new columns on work_items table
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'work_items'
  AND column_name IN ('revision_count', 'proof_sent_at', 'proof_approved_at', 'customer_feedback')
ORDER BY column_name;

-- 7. Verify all new columns on batches table
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'batches'
  AND column_name IN ('alibaba_order_number', 'drip_email_1_sent_at', 'drip_email_2_sent_at', 'drip_email_3_sent_at', 'drip_email_4_sent_at', 'drip_email_4_skipped')
ORDER BY column_name;

-- 8. Check indexes were created
SELECT
  schemaname,
  tablename,
  indexname
FROM pg_indexes
WHERE indexname LIKE 'idx_communications_%'
   OR indexname LIKE 'idx_work_items_%'
   OR indexname LIKE 'idx_batches_%'
ORDER BY tablename, indexname;
