-- Add approval system for proof approvals
-- This migration adds:
-- 1. approval_status column to work_items
-- 2. approval_tokens table for JWT-based approval links
-- 3. Seed customify-proof-approval email template

-- ============================================================================
-- Add approval_status to work_items
-- ============================================================================
ALTER TABLE work_items
ADD COLUMN approval_status TEXT CHECK (approval_status IN ('pending', 'approved', 'rejected', 'awaiting_approval'));

-- Add index for quick filtering by approval status
CREATE INDEX idx_work_items_approval_status ON work_items(approval_status) WHERE approval_status IS NOT NULL;

-- ============================================================================
-- Create approval_tokens table
-- ============================================================================
CREATE TABLE approval_tokens (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  work_item_id UUID NOT NULL REFERENCES work_items(id) ON DELETE CASCADE,
  token TEXT UNIQUE NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  used_at TIMESTAMPTZ,
  action TEXT NOT NULL CHECK (action IN ('approve', 'reject')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add indexes for token lookup and expiry checks
CREATE INDEX idx_approval_tokens_work_item ON approval_tokens(work_item_id);
CREATE INDEX idx_approval_tokens_token ON approval_tokens(token);
CREATE INDEX idx_approval_tokens_expires ON approval_tokens(expires_at);

-- Add updated_at trigger
CREATE TRIGGER update_approval_tokens_updated_at
BEFORE UPDATE ON approval_tokens
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- Seed customify proof approval email template
-- ============================================================================
INSERT INTO templates (key, name, subject_template, body_html_template, merge_fields, is_active)
VALUES (
  'customify-proof-approval',
  'Customify Proof Approval Email',
  'Your Custom Fan Order #{{orderNumber}} - Design Ready for Approval',
  '<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Proof Approval</title>
</head>
<body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="background-color: #f8f9fa; border-radius: 8px; padding: 20px; margin-bottom: 20px;">
    <h2 style="color: #2563eb; margin-top: 0;">Hi {{customerName}}!</h2>
    <p>Your custom fan design for order <strong>#{{orderNumber}}</strong> is ready for your approval.</p>
  </div>

  <div style="background-color: #fff; border: 2px solid #e5e7eb; border-radius: 8px; padding: 20px; margin-bottom: 20px;">
    <h3 style="margin-top: 0;">Your Design Proof:</h3>
    <div style="text-align: center; margin: 20px 0;">
      <img src="{{proofImageUrl}}" alt="Design Proof" style="max-width: 100%; height: auto; border-radius: 4px; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
    </div>
  </div>

  <div style="background-color: #f0fdf4; border-left: 4px solid #22c55e; padding: 15px; margin-bottom: 20px;">
    <p style="margin: 0; font-weight: 600;">Please review your design and let us know:</p>
  </div>

  <div style="text-align: center; margin: 30px 0;">
    <a href="{{approveLink}}" style="display: inline-block; background-color: #22c55e; color: white; text-decoration: none; padding: 12px 30px; border-radius: 6px; font-weight: 600; margin-right: 10px;">
      ✓ Approve Design
    </a>
    <a href="{{rejectLink}}" style="display: inline-block; background-color: #ef4444; color: white; text-decoration: none; padding: 12px 30px; border-radius: 6px; font-weight: 600;">
      ✗ Request Changes
    </a>
  </div>

  <div style="background-color: #f8f9fa; border-radius: 8px; padding: 15px; margin-top: 30px; font-size: 14px; color: #6b7280;">
    <p style="margin: 0;">If you have any questions or need changes to the design, simply reply to this email and we''ll get back to you right away!</p>
    <p style="margin: 10px 0 0 0;">Thanks for choosing The Gay Fan Club! 🏳️‍🌈</p>
  </div>

  <div style="text-align: center; margin-top: 30px; padding-top: 20px; border-top: 1px solid #e5e7eb; font-size: 12px; color: #9ca3af;">
    <p>The Gay Fan Club<br>
    <a href="mailto:sales@thegayfanclub.com" style="color: #2563eb;">sales@thegayfanclub.com</a></p>
  </div>
</body>
</html>',
  ARRAY['customerName', 'orderNumber', 'proofImageUrl', 'approveLink', 'rejectLink'],
  true
)
ON CONFLICT (key) DO UPDATE SET
  subject_template = EXCLUDED.subject_template,
  body_html_template = EXCLUDED.body_html_template,
  merge_fields = EXCLUDED.merge_fields,
  updated_at = NOW();
