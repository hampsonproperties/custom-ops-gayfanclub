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
-- Migration: Add Proof Version Control and Timeline Tracking
-- Phase 1: Critical Pain Points - Proof Organization
--
-- This migration adds:
-- 1. revision_count - tracks number of proof revisions (warns at 3+)
-- 2. proof_sent_at - timestamp when proof was sent to customer
-- 3. proof_approved_at - timestamp when customer approved the proof
-- 4. customer_feedback - stores customer comments/feedback on proofs

-- Add new columns to work_items table
ALTER TABLE work_items
  ADD COLUMN revision_count INTEGER DEFAULT 0,
  ADD COLUMN proof_sent_at TIMESTAMPTZ,
  ADD COLUMN proof_approved_at TIMESTAMPTZ,
  ADD COLUMN customer_feedback TEXT;

-- Create index for finding work items with many revisions
CREATE INDEX idx_work_items_revision_count ON work_items(revision_count)
  WHERE revision_count >= 3;

-- Create index for proof timeline queries
CREATE INDEX idx_work_items_proof_timeline ON work_items(proof_sent_at, proof_approved_at);

-- Backfill revision_count based on existing file versions
-- Count distinct versions of proof files, subtract 1 to get revision count
-- (v1 = original, v2 = 1st revision, v3 = 2nd revision, etc.)
UPDATE work_items wi
SET revision_count = COALESCE((
  SELECT COUNT(DISTINCT version) - 1
  FROM files
  WHERE work_item_id = wi.id
    AND kind = 'proof'
    AND version > 0
), 0);

-- Set proof_sent_at to the earliest proof file upload date
UPDATE work_items wi
SET proof_sent_at = (
  SELECT MIN(created_at)
  FROM files
  WHERE work_item_id = wi.id
    AND kind = 'proof'
)
WHERE EXISTS (
  SELECT 1 FROM files
  WHERE work_item_id = wi.id AND kind = 'proof'
);

-- Set proof_approved_at for work items that are already in approved status
UPDATE work_items
SET proof_approved_at = updated_at
WHERE design_review_status = 'approved'
  AND proof_approved_at IS NULL;

-- Add comment for documentation
COMMENT ON COLUMN work_items.revision_count IS 'Number of proof revisions (excluding original). Show warning at 3+';
COMMENT ON COLUMN work_items.proof_sent_at IS 'Timestamp when first proof was sent to customer';
COMMENT ON COLUMN work_items.proof_approved_at IS 'Timestamp when customer approved the proof';
COMMENT ON COLUMN work_items.customer_feedback IS 'Customer comments and feedback on proof versions';
-- Migration: Add Batch Drip Email Tracking
-- Phase 2: Automation & Discovery - Batch Drip Email Automation
--
-- This migration adds:
-- 1. alibaba_order_number - Tracks Alibaba order for batch
-- 2. drip_email_*_sent_at - Timestamps for each drip email (1-4)
-- 3. drip_email_4_skipped - Flag to skip email 4 if Shopify fulfillment webhook fires
--
-- Email Schedule:
-- - Email 1: "Order in production" (Day 0, when Alibaba # added)
-- - Email 2: "Shipped from facility" (Day 7)
-- - Email 3: "Going through customs" (Day 14)
-- - Email 4: "Arrived at warehouse" (Day 21) - skipped if Shopify fulfillment sent

-- Add new columns to batches table
ALTER TABLE batches
  ADD COLUMN alibaba_order_number TEXT,
  ADD COLUMN drip_email_1_sent_at TIMESTAMPTZ,
  ADD COLUMN drip_email_2_sent_at TIMESTAMPTZ,
  ADD COLUMN drip_email_3_sent_at TIMESTAMPTZ,
  ADD COLUMN drip_email_4_sent_at TIMESTAMPTZ,
  ADD COLUMN drip_email_4_skipped BOOLEAN DEFAULT false;

-- Create index for efficient drip email scheduling queries
CREATE INDEX idx_batches_drip_schedule ON batches(
  alibaba_order_number,
  drip_email_1_sent_at,
  drip_email_2_sent_at,
  drip_email_3_sent_at,
  drip_email_4_sent_at
) WHERE alibaba_order_number IS NOT NULL;

-- Create index for finding batches ready for each drip email
CREATE INDEX idx_batches_ready_for_email_1 ON batches(drip_email_1_sent_at)
  WHERE alibaba_order_number IS NOT NULL AND drip_email_1_sent_at IS NULL;

CREATE INDEX idx_batches_ready_for_email_2 ON batches(drip_email_1_sent_at, drip_email_2_sent_at)
  WHERE alibaba_order_number IS NOT NULL
    AND drip_email_1_sent_at IS NOT NULL
    AND drip_email_2_sent_at IS NULL;

CREATE INDEX idx_batches_ready_for_email_3 ON batches(drip_email_1_sent_at, drip_email_3_sent_at)
  WHERE alibaba_order_number IS NOT NULL
    AND drip_email_1_sent_at IS NOT NULL
    AND drip_email_3_sent_at IS NULL;

CREATE INDEX idx_batches_ready_for_email_4 ON batches(drip_email_1_sent_at, drip_email_4_sent_at, drip_email_4_skipped)
  WHERE alibaba_order_number IS NOT NULL
    AND drip_email_1_sent_at IS NOT NULL
    AND drip_email_4_sent_at IS NULL
    AND drip_email_4_skipped = false;

-- Add comments for documentation
COMMENT ON COLUMN batches.alibaba_order_number IS 'Alibaba order number - triggers drip email campaign when set';
COMMENT ON COLUMN batches.drip_email_1_sent_at IS 'Timestamp for "Order in production" email (sent immediately when Alibaba # added)';
COMMENT ON COLUMN batches.drip_email_2_sent_at IS 'Timestamp for "Shipped from facility" email (sent 7 days after email 1)';
COMMENT ON COLUMN batches.drip_email_3_sent_at IS 'Timestamp for "Going through customs" email (sent 14 days after email 1)';
COMMENT ON COLUMN batches.drip_email_4_sent_at IS 'Timestamp for "Arrived at warehouse" email (sent 21 days after email 1)';
COMMENT ON COLUMN batches.drip_email_4_skipped IS 'Skip email 4 if Shopify fulfillment webhook already sent tracking email';
-- Migration: Insert Batch Drip Email Templates
-- Phase 2: Automation & Discovery - Drip Email Templates
--
-- Creates 4 email templates for the batch drip campaign:
-- 1. drip_email_1: "Order in production" (Day 0)
-- 2. drip_email_2: "Shipped from facility" (Day 7)
-- 3. drip_email_3: "Going through customs" (Day 14)
-- 4. drip_email_4: "Arrived at warehouse" (Day 21)

-- Template 1: Order in Production
INSERT INTO templates (key, name, subject_template, body_html_template, merge_fields, is_active)
VALUES (
  'drip_email_1_production',
  'Batch Drip Email 1: Order in Production',
  'Great news! Your order {{batch_name}} is in production',
  '<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: linear-gradient(135deg, #FF0080 0%, #FF4081 100%); color: white; padding: 30px; text-align: center; border-radius: 8px 8px 0 0; }
    .content { background: #ffffff; padding: 30px; border: 1px solid #e0e0e0; border-top: none; }
    .footer { background: #f5f5f5; padding: 20px; text-align: center; font-size: 12px; color: #666; border-radius: 0 0 8px 8px; }
    .cta-button { display: inline-block; background: #FF0080; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; margin: 20px 0; }
    .status-badge { background: #4CAF50; color: white; padding: 8px 16px; border-radius: 20px; display: inline-block; font-weight: bold; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>🎉 Your Order is in Production!</h1>
    </div>
    <div class="content">
      <p>Hi there!</p>

      <p>Exciting news! Your custom fan order <strong>{{batch_name}}</strong> (Alibaba Order #{{alibaba_order_number}}) has entered production at our manufacturing facility.</p>

      <p><span class="status-badge">✓ IN PRODUCTION</span></p>

      <p><strong>What happens next?</strong></p>
      <ul>
        <li>Your fans are being carefully manufactured to your exact specifications</li>
        <li>Quality control checks at multiple stages</li>
        <li>In approximately 7 days, they''ll ship from the facility</li>
        <li>We''ll keep you updated every step of the way!</li>
      </ul>

      <p>Expected timeline:</p>
      <ul>
        <li>📦 <strong>Week 1:</strong> Manufacturing (you are here!)</li>
        <li>🚚 <strong>Week 2:</strong> Shipping to USA</li>
        <li>🛃 <strong>Week 3:</strong> Customs clearance</li>
        <li>🏠 <strong>Week 4:</strong> Arrival at warehouse & final QC</li>
      </ul>

      <p>Questions? Just reply to this email - we''re here to help!</p>

      <p>Best regards,<br>The Gay Fan Club Team</p>
    </div>
    <div class="footer">
      <p>The Gay Fan Club | Premium Custom Fans for Every Occasion</p>
      <p>This is an automated update. We''ll send you another update when your order ships!</p>
    </div>
  </div>
</body>
</html>',
  ARRAY['batch_name', 'alibaba_order_number'],
  true
);

-- Template 2: Shipped from Facility
INSERT INTO templates (key, name, subject_template, body_html_template, merge_fields, is_active)
VALUES (
  'drip_email_2_shipped',
  'Batch Drip Email 2: Shipped from Facility',
  'Your order {{batch_name}} has shipped! 📦',
  '<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: linear-gradient(135deg, #FF0080 0%, #FF4081 100%); color: white; padding: 30px; text-align: center; border-radius: 8px 8px 0 0; }
    .content { background: #ffffff; padding: 30px; border: 1px solid #e0e0e0; border-top: none; }
    .footer { background: #f5f5f5; padding: 20px; text-align: center; font-size: 12px; color: #666; border-radius: 0 0 8px 8px; }
    .status-badge { background: #2196F3; color: white; padding: 8px 16px; border-radius: 20px; display: inline-block; font-weight: bold; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>📦 Your Order Has Shipped!</h1>
    </div>
    <div class="content">
      <p>Hi there!</p>

      <p>Great news! Your custom fan order <strong>{{batch_name}}</strong> has been shipped from our manufacturing facility and is on its way to the United States.</p>

      <p><span class="status-badge">✓ SHIPPED</span></p>

      <p><strong>What''s happening now?</strong></p>
      <ul>
        <li>Your order is in transit to the USA</li>
        <li>Estimated transit time: 7-10 days</li>
        <li>Next stop: US Customs</li>
        <li>We''ll update you when it reaches customs</li>
      </ul>

      <p>Progress tracker:</p>
      <ul>
        <li>✅ <strong>Week 1:</strong> Manufacturing complete</li>
        <li>✅ <strong>Week 2:</strong> Shipping to USA (you are here!)</li>
        <li>⏳ <strong>Week 3:</strong> Customs clearance</li>
        <li>⏳ <strong>Week 4:</strong> Arrival at warehouse</li>
      </ul>

      <p>Your fans are one step closer to you! We''re excited for you to receive them.</p>

      <p>Questions? Just reply to this email!</p>

      <p>Best regards,<br>The Gay Fan Club Team</p>
    </div>
    <div class="footer">
      <p>The Gay Fan Club | Premium Custom Fans for Every Occasion</p>
      <p>This is an automated update. We''ll notify you when your order clears customs!</p>
    </div>
  </div>
</body>
</html>',
  ARRAY['batch_name'],
  true
);

-- Template 3: Going Through Customs
INSERT INTO templates (key, name, subject_template, body_html_template, merge_fields, is_active)
VALUES (
  'drip_email_3_customs',
  'Batch Drip Email 3: Going Through Customs',
  'Update: Your order {{batch_name}} is clearing customs 🛃',
  '<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: linear-gradient(135deg, #FF0080 0%, #FF4081 100%); color: white; padding: 30px; text-align: center; border-radius: 8px 8px 0 0; }
    .content { background: #ffffff; padding: 30px; border: 1px solid #e0e0e0; border-top: none; }
    .footer { background: #f5f5f5; padding: 20px; text-align: center; font-size: 12px; color: #666; border-radius: 0 0 8px 8px; }
    .status-badge { background: #FF9800; color: white; padding: 8px 16px; border-radius: 20px; display: inline-block; font-weight: bold; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>🛃 Customs Clearance in Progress</h1>
    </div>
    <div class="content">
      <p>Hi there!</p>

      <p>Quick update on your custom fan order <strong>{{batch_name}}</strong>: it has arrived in the United States and is currently going through customs clearance.</p>

      <p><span class="status-badge">✓ AT CUSTOMS</span></p>

      <p><strong>What does this mean?</strong></p>
      <ul>
        <li>Your order has successfully arrived in the USA</li>
        <li>It''s being processed through customs (routine procedure)</li>
        <li>Estimated clearance time: 3-5 business days</li>
        <li>Once cleared, it will be delivered to our warehouse</li>
      </ul>

      <p>Progress tracker:</p>
      <ul>
        <li>✅ <strong>Week 1:</strong> Manufacturing complete</li>
        <li>✅ <strong>Week 2:</strong> Shipped to USA</li>
        <li>✅ <strong>Week 3:</strong> Customs clearance (you are here!)</li>
        <li>⏳ <strong>Week 4:</strong> Final QC & ready to ship to you</li>
      </ul>

      <p>We''re almost there! One more update coming when your order reaches our warehouse.</p>

      <p>Questions about customs or timeline? Reply to this email anytime!</p>

      <p>Best regards,<br>The Gay Fan Club Team</p>
    </div>
    <div class="footer">
      <p>The Gay Fan Club | Premium Custom Fans for Every Occasion</p>
      <p>This is an automated update. Final notification coming when your order is ready to ship!</p>
    </div>
  </div>
</body>
</html>',
  ARRAY['batch_name'],
  true
);

-- Template 4: Arrived at Warehouse
INSERT INTO templates (key, name, subject_template, body_html_template, merge_fields, is_active)
VALUES (
  'drip_email_4_warehouse',
  'Batch Drip Email 4: Arrived at Warehouse',
  '🎉 Your order {{batch_name}} has arrived at our warehouse!',
  '<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: linear-gradient(135deg, #FF0080 0%, #FF4081 100%); color: white; padding: 30px; text-align: center; border-radius: 8px 8px 0 0; }
    .content { background: #ffffff; padding: 30px; border: 1px solid #e0e0e0; border-top: none; }
    .footer { background: #f5f5f5; padding: 20px; text-align: center; font-size: 12px; color: #666; border-radius: 0 0 8px 8px; }
    .status-badge { background: #4CAF50; color: white; padding: 8px 16px; border-radius: 20px; display: inline-block; font-weight: bold; }
    .cta-button { display: inline-block; background: #FF0080; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; margin: 20px 0; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>🎉 Your Order Has Arrived!</h1>
    </div>
    <div class="content">
      <p>Hi there!</p>

      <p>Fantastic news! Your custom fan order <strong>{{batch_name}}</strong> has successfully cleared customs and arrived at our warehouse.</p>

      <p><span class="status-badge">✓ AT WAREHOUSE</span></p>

      <p><strong>What happens now?</strong></p>
      <ul>
        <li>Our QC team will perform a final quality inspection</li>
        <li>Your order will be prepared for shipment</li>
        <li>You''ll receive a Shopify tracking notification when it ships (typically within 2-3 business days)</li>
        <li>Delivery to your door in 3-5 business days after that!</li>
      </ul>

      <p>Progress tracker:</p>
      <ul>
        <li>✅ <strong>Week 1:</strong> Manufacturing complete</li>
        <li>✅ <strong>Week 2:</strong> Shipped to USA</li>
        <li>✅ <strong>Week 3:</strong> Customs cleared</li>
        <li>✅ <strong>Week 4:</strong> At warehouse (you are here!)</li>
      </ul>

      <p>Your fans have completed their journey and are almost ready to ship to you. Watch for your final tracking notification coming soon!</p>

      <p>Thank you for your patience throughout this process. We can''t wait for you to receive your beautiful custom fans!</p>

      <p>Questions? Just reply to this email.</p>

      <p>Best regards,<br>The Gay Fan Club Team</p>
    </div>
    <div class="footer">
      <p>The Gay Fan Club | Premium Custom Fans for Every Occasion</p>
      <p>This was your final automated update. Your Shopify tracking will arrive when your order ships!</p>
    </div>
  </div>
</body>
</html>',
  ARRAY['batch_name'],
  true
);

-- Add comment for documentation
COMMENT ON TABLE templates IS 'Email templates including batch drip campaign templates (drip_email_1-4)';
