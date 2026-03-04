-- ============================================================================
-- Run this in Supabase SQL Editor to check which migrations are applied
-- ============================================================================

-- Migration 1: Email Deduplication
SELECT 'Migration 1: Email Deduplication' as migration,
  CASE
    WHEN EXISTS (
      SELECT 1 FROM information_schema.table_constraints
      WHERE constraint_name = 'uq_communications_provider_message_id'
    ) THEN '✅ APPLIED'
    ELSE '❌ NOT APPLIED'
  END as status;

-- Migration 2: Dead Letter Queue
SELECT 'Migration 2: Dead Letter Queue' as migration,
  CASE
    WHEN EXISTS (
      SELECT 1 FROM information_schema.tables
      WHERE table_name = 'dead_letter_queue'
    ) THEN '✅ APPLIED'
    ELSE '❌ NOT APPLIED'
  END as status;

-- Migration 3: Stuck Items
SELECT 'Migration 3: Stuck Items Views' as migration,
  CASE
    WHEN EXISTS (
      SELECT 1 FROM information_schema.views
      WHERE table_name = 'stuck_items_dashboard'
    ) THEN '✅ APPLIED'
    ELSE '❌ NOT APPLIED'
  END as status;

-- Migration 4: Email Filters (CRITICAL FOR SPAM)
SELECT 'Migration 4: Email Filters ⭐ CRITICAL' as migration,
  CASE
    WHEN EXISTS (
      SELECT 1 FROM information_schema.tables
      WHERE table_name = 'email_filters'
    ) THEN '✅ APPLIED'
    ELSE '❌ NOT APPLIED'
  END as status;

-- Migration 5: Conversations
SELECT 'Migration 5: Conversations Table' as migration,
  CASE
    WHEN EXISTS (
      SELECT 1 FROM information_schema.tables
      WHERE table_name = 'conversations'
    ) THEN '✅ APPLIED'
    ELSE '❌ NOT APPLIED'
  END as status;

-- Migration 6: Reminder Engine
SELECT 'Migration 6: Reminder Engine' as migration,
  CASE
    WHEN EXISTS (
      SELECT 1 FROM information_schema.tables
      WHERE table_name = 'reminder_templates'
    ) THEN '✅ APPLIED'
    ELSE '❌ NOT APPLIED'
  END as status;

-- Migration 7: Quick Replies
SELECT 'Migration 7: Quick Reply Templates' as migration,
  CASE
    WHEN EXISTS (
      SELECT 1 FROM information_schema.tables
      WHERE table_name = 'quick_reply_templates'
    ) THEN '✅ APPLIED'
    ELSE '❌ NOT APPLIED'
  END as status;
