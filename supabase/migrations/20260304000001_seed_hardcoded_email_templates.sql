-- ============================================================================
-- Migration: Seed hardcoded email templates into quick_reply_templates
-- Purpose: Migrate the 9 hardcoded templates from lib/email-templates.ts into
--          the database so they can be managed from Settings. This makes
--          quick_reply_templates the single source of truth for staff-facing
--          email templates.
-- Created: 2026-03-04
-- ============================================================================

-- 1. EXPAND CATEGORY CHECK CONSTRAINT
-- The original constraint only allowed: general, customization_options,
-- shipping_timeline, design_changes, payment_terms, file_requirements, support.
-- We need to add: lead, design, production (used by the hardcoded templates).
-- ============================================================================
ALTER TABLE quick_reply_templates DROP CONSTRAINT IF EXISTS quick_reply_templates_category_check;
ALTER TABLE quick_reply_templates ADD CONSTRAINT quick_reply_templates_category_check
  CHECK (category IN (
    'general',
    'customization_options',
    'shipping_timeline',
    'design_changes',
    'payment_terms',
    'file_requirements',
    'support',
    'lead',
    'design',
    'production'
  ));

-- 2. INSERT 9 HARDCODED TEMPLATES (skip if key already exists)
-- ============================================================================

-- Lead/Sales: Initial Response
INSERT INTO quick_reply_templates (key, name, description, category, subject_template, body_html_template, requires_customization)
VALUES (
  'initial-response',
  'Initial Response',
  'First response to a new inquiry',
  'lead',
  'Re: Custom Fan Order',
  'Hi there!

Thanks so much for reaching out about custom fans! I''m excited to help you create something special for your event.

To get started, I''d love to learn more about your vision:

• What''s the occasion/event?
• When do you need them by?
• How many fans are you thinking?
• Do you have any design ideas or artwork already?

Once I understand your needs, I''ll put together a custom quote for you. Our design fee is $250, which gets you:
- Custom design mockup tailored to your event
- Up to 2 rounds of revisions
- $250 credit toward your production order

Looking forward to working with you!

Best,
Gay Fan Club Team',
  false
) ON CONFLICT (key) DO NOTHING;

-- Lead/Sales: Quote Follow-Up
INSERT INTO quick_reply_templates (key, name, description, category, subject_template, body_html_template, requires_customization)
VALUES (
  'quote-follow-up',
  'Quote Follow-Up',
  'Follow up on a sent quote',
  'lead',
  'Following up on your custom fan quote',
  'Hi there!

I wanted to follow up on the custom quote I sent over last week. I know planning events can be busy, so I wanted to make sure you didn''t miss it!

I''m here to answer any questions you might have about:
- Pricing and quantity options
- Design process and timeline
- Shipping and delivery

If you''re ready to move forward, we can get started right away with the design process.

Let me know how I can help!

Best,
Gay Fan Club Team',
  false
) ON CONFLICT (key) DO NOTHING;

-- Lead/Sales: Pricing Information
INSERT INTO quick_reply_templates (key, name, description, category, subject_template, body_html_template, requires_customization)
VALUES (
  'pricing-info',
  'Pricing Information',
  'Detailed pricing breakdown',
  'lead',
  'Custom Fan Pricing & Options',
  'Hi!

Thanks for your interest in custom fans! Here''s our pricing structure:

DESIGN FEE: $250 (one-time)
- Custom design mockup
- 2 rounds of revisions
- $250 credit toward production

PRODUCTION PRICING (per fan):
- 50-99 fans: $12 each
- 100-249 fans: $10 each
- 250-499 fans: $8 each
- 500+ fans: $7 each

SHIPPING:
- Domestic: $25-50 (depending on quantity)
- Rush options available

TIMELINE:
- Design: 2-3 business days
- Production: 2-3 weeks after approval
- Shipping: 3-5 business days

What quantity are you thinking? I''d be happy to put together a custom quote!

Best,
Gay Fan Club Team',
  false
) ON CONFLICT (key) DO NOTHING;

-- Design: Design Fee Invoice Sent
INSERT INTO quick_reply_templates (key, name, description, category, subject_template, body_html_template, requires_customization)
VALUES (
  'design-fee-invoice',
  'Design Fee Invoice Sent',
  'Sent with design fee invoice link',
  'design',
  'Your Custom Fan Design Fee Invoice',
  'Hi!

Great news - I''ve created your design fee invoice!

You can pay securely here: [INVOICE_LINK]

Once payment is received, our designer will start working on your custom mockup. You''ll typically see the first draft within 2-3 business days.

The $250 design fee includes:
- Custom design tailored to your specifications
- Up to 2 rounds of revisions
- $250 credit toward your production order (when you''re ready to print!)

Excited to bring your vision to life!

Best,
Gay Fan Club Team',
  true
) ON CONFLICT (key) DO NOTHING;

-- Design: Design Ready for Review
INSERT INTO quick_reply_templates (key, name, description, category, subject_template, body_html_template, requires_customization)
VALUES (
  'design-ready',
  'Design Ready for Review',
  'Sending initial design mockup',
  'design',
  'Your Custom Fan Design is Ready!',
  'Hi!

Exciting news - your custom fan design is ready for review!

Please take a look at the attached mockup and let me know your thoughts. You get up to 2 rounds of revisions included, so don''t hesitate to request changes.

Things to review:
- Overall layout and composition
- Colors and text
- Logo/artwork placement
- Any additional details you''d like adjusted

Once you approve the design, I''ll send over the production invoice. Remember, your $250 design fee will be credited toward your order!

Can''t wait to hear what you think!

Best,
Gay Fan Club Team',
  false
) ON CONFLICT (key) DO NOTHING;

-- Production: Production Invoice Sent
INSERT INTO quick_reply_templates (key, name, description, category, subject_template, body_html_template, requires_customization)
VALUES (
  'production-invoice',
  'Production Invoice Sent',
  'Sent with production invoice link',
  'production',
  'Your Custom Fan Production Invoice',
  'Hi!

Your design is approved and looks amazing! I''ve created your production invoice:

[INVOICE_LINK]

As discussed, your $250 design fee has been credited to this order. Once payment is received, we''ll begin production right away.

Timeline:
- Production: 2-3 weeks
- Shipping: 3-5 business days (domestic)

I''ll keep you updated throughout the process!

Best,
Gay Fan Club Team',
  true
) ON CONFLICT (key) DO NOTHING;

-- Production: Production Update
INSERT INTO quick_reply_templates (key, name, description, category, subject_template, body_html_template, requires_customization)
VALUES (
  'production-update',
  'Production Update',
  'General production status update',
  'production',
  'Update on Your Custom Fan Order',
  'Hi!

Just wanted to give you a quick update on your custom fan order!

Your fans are currently in production and everything is looking great. We''re still on track to ship by [DATE].

I''ll send you tracking information as soon as they ship!

Let me know if you have any questions.

Best,
Gay Fan Club Team',
  true
) ON CONFLICT (key) DO NOTHING;

-- Production: Shipping Notification
INSERT INTO quick_reply_templates (key, name, description, category, subject_template, body_html_template, requires_customization)
VALUES (
  'shipping-notification',
  'Shipping Notification',
  'Order has been shipped',
  'production',
  'Your Custom Fans Have Shipped!',
  'Hi!

Great news - your custom fans have shipped!

Tracking Number: [TRACKING_NUMBER]
Carrier: [CARRIER]
Expected Delivery: [DATE]

You can track your package here: [TRACKING_LINK]

Your fans should arrive in plenty of time for your event. If you have any questions or concerns, please don''t hesitate to reach out.

Thanks for choosing Gay Fan Club!

Best,
Gay Fan Club Team',
  true
) ON CONFLICT (key) DO NOTHING;

-- General: Thank You / Follow-Up
INSERT INTO quick_reply_templates (key, name, description, category, subject_template, body_html_template, requires_customization)
VALUES (
  'thank-you',
  'Thank You / Follow-Up',
  'Post-delivery thank you',
  'general',
  'Thank you for your order!',
  'Hi!

I hope your custom fans arrived safely and you love them!

I''d be thrilled to see photos from your event if you''re willing to share. We love featuring our customers'' creations!

If you need fans for future events, you already have a design on file, which makes reordering super easy.

Thanks again for choosing Gay Fan Club!

Best,
Gay Fan Club Team',
  false
) ON CONFLICT (key) DO NOTHING;

-- 3. VERIFY
-- ============================================================================
DO $$
DECLARE
  total INTEGER;
  new_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO total FROM quick_reply_templates WHERE is_active = TRUE;
  SELECT COUNT(*) INTO new_count FROM quick_reply_templates WHERE key IN (
    'initial-response', 'quote-follow-up', 'pricing-info',
    'design-fee-invoice', 'design-ready',
    'production-invoice', 'production-update', 'shipping-notification',
    'thank-you'
  );
  RAISE NOTICE 'Seed complete: % new templates added, % total active templates', new_count, total;
END $$;
