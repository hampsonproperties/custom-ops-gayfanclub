-- Migration: Add Email Ownership and Priority System
-- Phase 1: Critical Pain Points - Email Ownership & Priority Inbox
--
-- This migration adds:
-- 1. owner_user_id - tracks who owns/is responsible for each email
-- 2. priority - automatic priority calculation (high/medium/low)
-- 3. email_status - tracks reply status (needs_reply/waiting_on_customer/closed)

-- Add new columns to communications table
ALTER TABLE communications
  ADD COLUMN owner_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  ADD COLUMN priority TEXT CHECK (priority IN ('high', 'medium', 'low')) DEFAULT 'medium',
  ADD COLUMN email_status TEXT CHECK (email_status IN ('needs_reply', 'waiting_on_customer', 'closed')) DEFAULT 'needs_reply';

-- Create index for efficient priority inbox queries
CREATE INDEX idx_communications_owner_priority ON communications(owner_user_id, priority, email_status)
  WHERE email_status != 'closed';

-- Create index for finding emails by owner
CREATE INDEX idx_communications_owner ON communications(owner_user_id)
  WHERE owner_user_id IS NOT NULL;

-- Backfill existing data: Set owner to work item assignee
-- This ensures existing emails have an owner based on current work item assignments
UPDATE communications c
SET owner_user_id = wi.assigned_to_user_id
FROM work_items wi
WHERE c.work_item_id = wi.id
  AND c.owner_user_id IS NULL
  AND wi.assigned_to_user_id IS NOT NULL;

-- Set initial priority based on direction and time since last activity
-- Inbound emails that haven't been replied to in >24h = high priority
UPDATE communications
SET priority = 'high'
WHERE direction = 'inbound'
  AND email_status = 'needs_reply'
  AND sent_at < NOW() - INTERVAL '24 hours';

-- Outbound emails waiting for customer response >48h = medium priority
UPDATE communications
SET priority = 'medium',
    email_status = 'waiting_on_customer'
WHERE direction = 'outbound'
  AND sent_at < NOW() - INTERVAL '48 hours';
