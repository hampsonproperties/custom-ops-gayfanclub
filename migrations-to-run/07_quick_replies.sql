-- ============================================================================
-- Migration: Create Quick Reply Templates
-- Purpose: Pre-built responses for common customer questions (e.g., "Customization options")
-- Created: 2026-02-19
-- ============================================================================

-- 1. CREATE QUICK_REPLY_TEMPLATES TABLE
-- ============================================================================
CREATE TABLE quick_reply_templates (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

  -- Template identification
  key TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  category TEXT DEFAULT 'general' CHECK (category IN (
    'general',
    'customization_options',
    'shipping_timeline',
    'design_changes',
    'payment_terms',
    'file_requirements',
    'support'
  )),

  -- Template content
  subject_template TEXT,
  body_html_template TEXT NOT NULL,
  body_plain_template TEXT,

  -- Merge fields
  merge_fields TEXT[], -- {{customer_name}}, {{work_item_title}}, etc.

  -- Attachments
  has_attachments BOOLEAN DEFAULT FALSE,
  attachment_urls TEXT[],

  -- Configuration
  is_active BOOLEAN DEFAULT TRUE,
  requires_customization BOOLEAN DEFAULT FALSE, -- Must edit before sending

  -- Usage stats
  use_count INTEGER DEFAULT 0,
  last_used_at TIMESTAMPTZ,

  -- Shortcuts
  keyboard_shortcut TEXT, -- e.g., "Ctrl+1" or just "1" for quick access

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_quick_reply_category ON quick_reply_templates(category);
CREATE INDEX idx_quick_reply_active ON quick_reply_templates(is_active) WHERE is_active = TRUE;
CREATE INDEX idx_quick_reply_shortcut ON quick_reply_templates(keyboard_shortcut) WHERE keyboard_shortcut IS NOT NULL;

-- 2. SEED COMMON QUICK REPLY TEMPLATES
-- ============================================================================

-- Customization options (316 instances in EMAIL_TYPES_DETAILED_REPORT.md)
INSERT INTO quick_reply_templates (
  key,
  name,
  description,
  category,
  subject_template,
  body_html_template,
  merge_fields,
  keyboard_shortcut
) VALUES (
  'customization_options',
  'Customization Options - Standard',
  'Explain customization options for fan products',
  'customization_options',
  'Re: {{original_subject}}',
  '<p>Hi {{customer_name}},</p>

<p>Great question! Here are the customization options available for your order:</p>

<h3>Text & Design</h3>
<ul>
  <li><strong>Custom Text:</strong> Add any text you''d like (names, messages, logos)</li>
  <li><strong>Colors:</strong> Choose from our full color palette</li>
  <li><strong>Font Options:</strong> Multiple fonts available (we can send samples)</li>
  <li><strong>Positioning:</strong> We can adjust placement to fit your design</li>
</ul>

<h3>Special Features</h3>
<ul>
  <li><strong>Double-Sided:</strong> Different designs on each side</li>
  <li><strong>Metallic/Foil:</strong> Add shimmer or metallic accents</li>
  <li><strong>Photo Printing:</strong> High-quality photo reproduction</li>
</ul>

<p>Would you like to schedule a quick call to discuss your specific needs? Or feel free to share your design ideas, and I''ll create a mockup for you!</p>

<p>Best regards,<br>
The Gay Fan Club Team</p>',
  ARRAY['customer_name', 'original_subject'],
  '1'
);

-- Shipping timeline
INSERT INTO quick_reply_templates (
  key,
  name,
  description,
  category,
  subject_template,
  body_html_template,
  merge_fields,
  keyboard_shortcut
) VALUES (
  'shipping_timeline',
  'Shipping Timeline - Standard',
  'Explain standard production and shipping timeline',
  'shipping_timeline',
  'Re: {{original_subject}}',
  '<p>Hi {{customer_name}},</p>

<p>Here''s our typical timeline for your order:</p>

<ul>
  <li><strong>Design Approval:</strong> 1-2 business days after we receive your artwork/details</li>
  <li><strong>Production:</strong> 7-10 business days after approval</li>
  <li><strong>Shipping:</strong> 3-5 business days (standard) or 2-3 days (expedited)</li>
</ul>

<p><strong>Total Time:</strong> Approximately 2-3 weeks from design approval to delivery.</p>

<p>If you have a specific event date, let me know and we''ll do our best to accommodate!</p>

<p>Best regards,<br>
The Gay Fan Club Team</p>',
  ARRAY['customer_name', 'original_subject'],
  '2'
);

-- File requirements
INSERT INTO quick_reply_templates (
  key,
  name,
  description,
  category,
  subject_template,
  body_html_template,
  merge_fields,
  keyboard_shortcut
) VALUES (
  'file_requirements',
  'File Requirements & Formats',
  'Explain what file formats and requirements we need',
  'file_requirements',
  'Re: {{original_subject}}',
  '<p>Hi {{customer_name}},</p>

<p>To get started with your custom design, here''s what we need:</p>

<h3>Preferred File Formats</h3>
<ul>
  <li><strong>Vector files:</strong> AI, EPS, PDF, SVG (best quality)</li>
  <li><strong>High-res images:</strong> PNG, JPG (at least 300 DPI)</li>
  <li><strong>Design files:</strong> PSD, Illustrator files</li>
</ul>

<h3>Requirements</h3>
<ul>
  <li>Minimum resolution: 300 DPI</li>
  <li>RGB or CMYK color mode</li>
  <li>Transparent background (if applicable)</li>
  <li>Editable text layers (for text changes)</li>
</ul>

<p><strong>Don''t have the right files?</strong> No problem! Send us what you have, and our design team can work with it or recreate it for you.</p>

<p>You can reply to this email with your files attached, or use our secure upload portal: [Upload Link]</p>

<p>Best regards,<br>
The Gay Fan Club Team</p>',
  ARRAY['customer_name', 'original_subject'],
  '3'
);

-- Design changes
INSERT INTO quick_reply_templates (
  key,
  name,
  description,
  category,
  subject_template,
  body_html_template,
  merge_fields,
  keyboard_shortcut
) VALUES (
  'design_changes_revision',
  'Design Changes - Revision Request',
  'Acknowledge design change request',
  'design_changes',
  'Re: {{original_subject}}',
  '<p>Hi {{customer_name}},</p>

<p>Thanks for your feedback on the design! I''ll have our design team make the following changes:</p>

<p><em>[List the requested changes here]</em></p>

<p>We''ll send you an updated proof within 1-2 business days.</p>

<p><strong>Reminder:</strong> You get unlimited revisions until the design is perfect! Don''t hesitate to request any changes.</p>

<p>Best regards,<br>
The Gay Fan Club Team</p>',
  ARRAY['customer_name', 'original_subject'],
  '4'
);

-- Missing items support
INSERT INTO quick_reply_templates (
  key,
  name,
  description,
  category,
  subject_template,
  body_html_template,
  merge_fields,
  keyboard_shortcut
) VALUES (
  'support_missing_items',
  'Support - Missing Items',
  'Handle missing items from shipment',
  'support',
  'Re: Missing Items - {{work_item_title}}',
  '<p>Hi {{customer_name}},</p>

<p>I''m so sorry to hear that some items are missing from your shipment! We take this very seriously.</p>

<p>To help resolve this as quickly as possible, could you please provide:</p>

<ol>
  <li>Which specific items are missing (names, quantities)</li>
  <li>Photo of what you received</li>
  <li>Order number (if not already included)</li>
</ol>

<p>Once we have this information, we''ll:</p>
<ul>
  <li>Verify the shipment details</li>
  <li>Rush replacement items to you at no charge</li>
  <li>Provide expedited shipping</li>
</ul>

<p>I''ll personally make sure this is resolved immediately. Please reply with the details above.</p>

<p>Sincerely,<br>
The Gay Fan Club Team</p>',
  ARRAY['customer_name', 'work_item_title'],
  NULL
);

-- Damaged items support
INSERT INTO quick_reply_templates (
  key,
  name,
  description,
  category,
  subject_template,
  body_html_template,
  merge_fields,
  keyboard_shortcut
) VALUES (
  'support_damaged_items',
  'Support - Damaged Items',
  'Handle damaged items report',
  'support',
  'Re: Damaged Items - {{work_item_title}}',
  '<p>Hi {{customer_name}},</p>

<p>I''m very sorry to hear that your items arrived damaged. This is not the quality we stand for!</p>

<p>To process your replacement as quickly as possible, please send us:</p>

<ol>
  <li>Photos of the damaged items (close-ups showing the damage)</li>
  <li>Photo of the shipping box/packaging (if damaged)</li>
  <li>Number of damaged items</li>
</ol>

<p>We''ll immediately:</p>
<ul>
  <li>Rush replacement items into production</li>
  <li>Ship with expedited delivery at no charge</li>
  <li>File a claim with the shipping carrier</li>
</ul>

<p>You don''t need to return the damaged items. Just reply with the photos, and we''ll take care of everything.</p>

<p>Sincerely,<br>
The Gay Fan Club Team</p>',
  ARRAY['customer_name', 'work_item_title'],
  NULL
);

-- Payment terms
INSERT INTO quick_reply_templates (
  key,
  name,
  description,
  category,
  subject_template,
  body_html_template,
  merge_fields,
  keyboard_shortcut
) VALUES (
  'payment_terms',
  'Payment Terms & Options',
  'Explain payment terms and available options',
  'payment_terms',
  'Re: {{original_subject}}',
  '<p>Hi {{customer_name}},</p>

<p>Here are our payment options for your order:</p>

<h3>Payment Structure</h3>
<ul>
  <li><strong>50% Deposit:</strong> Due upfront to start production</li>
  <li><strong>50% Balance:</strong> Due before shipping</li>
</ul>

<h3>Payment Methods</h3>
<ul>
  <li>Credit/Debit Card (Visa, Mastercard, Amex)</li>
  <li>PayPal</li>
  <li>Bank Transfer/ACH</li>
  <li>Check (add 5-7 business days for processing)</li>
</ul>

<p><strong>Net Terms Available:</strong> For established customers or large orders, we offer Net 30 terms. Just let me know if you''d like to set this up.</p>

<p>Ready to get started? I can send you a secure payment link!</p>

<p>Best regards,<br>
The Gay Fan Club Team</p>',
  ARRAY['customer_name', 'original_subject'],
  '5'
);

-- Bulk order discount
INSERT INTO quick_reply_templates (
  key,
  name,
  description,
  category,
  subject_template,
  body_html_template,
  merge_fields,
  keyboard_shortcut
) VALUES (
  'bulk_order_discount',
  'Bulk Order Discounts',
  'Explain volume pricing and bulk discounts',
  'general',
  'Re: {{original_subject}}',
  '<p>Hi {{customer_name}},</p>

<p>Great question about bulk pricing! We definitely offer discounts for larger orders:</p>

<h3>Volume Discounts</h3>
<ul>
  <li><strong>100-249 units:</strong> 10% off</li>
  <li><strong>250-499 units:</strong> 15% off</li>
  <li><strong>500+ units:</strong> 20% off (+ free shipping)</li>
</ul>

<p><strong>Additional Savings:</strong></p>
<ul>
  <li>Free design setup for orders over 250 units</li>
  <li>Free sample pack with orders over 500 units</li>
  <li>Priority production (faster turnaround)</li>
</ul>

<p>How many units are you thinking? I can send you a custom quote with exact pricing!</p>

<p>Best regards,<br>
The Gay Fan Club Team</p>',
  ARRAY['customer_name', 'original_subject'],
  '6'
);

-- 3. CREATE FUNCTION TO INCREMENT USE COUNT
-- ============================================================================
CREATE OR REPLACE FUNCTION track_template_usage(p_template_id UUID)
RETURNS VOID
LANGUAGE plpgsql
AS $$
BEGIN
  UPDATE quick_reply_templates
  SET
    use_count = use_count + 1,
    last_used_at = NOW(),
    updated_at = NOW()
  WHERE id = p_template_id;
END;
$$;

COMMENT ON FUNCTION track_template_usage IS
'Increments use_count when a template is used.';

-- 4. CREATE TEMPLATE USAGE STATS VIEW
-- ============================================================================
CREATE OR REPLACE VIEW template_usage_stats AS
SELECT
  t.key,
  t.name,
  t.category,
  t.use_count,
  t.last_used_at,
  t.is_active,
  t.keyboard_shortcut
FROM quick_reply_templates t
WHERE t.is_active = TRUE
ORDER BY t.use_count DESC;

COMMENT ON VIEW template_usage_stats IS
'Usage statistics for quick reply templates, ordered by most used.';

-- 5. ADD UPDATED_AT TRIGGER
-- ============================================================================
CREATE TRIGGER update_quick_reply_templates_updated_at
BEFORE UPDATE ON quick_reply_templates
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

-- 6. LOG MIGRATION RESULTS
-- ============================================================================
DO $$
DECLARE
  template_count INTEGER;
  category_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO template_count FROM quick_reply_templates;
  SELECT COUNT(DISTINCT category) INTO category_count FROM quick_reply_templates;

  RAISE NOTICE 'Quick Reply Templates Migration Complete';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'Created table: quick_reply_templates';
  RAISE NOTICE '';
  RAISE NOTICE 'Seeded % templates across % categories:', template_count, category_count;
  RAISE NOTICE '  - Customization options (solves 316 manual responses)';
  RAISE NOTICE '  - Shipping timeline';
  RAISE NOTICE '  - File requirements';
  RAISE NOTICE '  - Design changes';
  RAISE NOTICE '  - Support (missing/damaged items)';
  RAISE NOTICE '  - Payment terms';
  RAISE NOTICE '  - Bulk order discounts';
  RAISE NOTICE '';
  RAISE NOTICE 'Keyboard shortcuts:';
  RAISE NOTICE '  1 - Customization options';
  RAISE NOTICE '  2 - Shipping timeline';
  RAISE NOTICE '  3 - File requirements';
  RAISE NOTICE '  4 - Design changes';
  RAISE NOTICE '  5 - Payment terms';
  RAISE NOTICE '  6 - Bulk discounts';
  RAISE NOTICE '';
  RAISE NOTICE 'Created function: track_template_usage()';
  RAISE NOTICE 'Created view: template_usage_stats';
  RAISE NOTICE '';
  RAISE NOTICE 'Next steps:';
  RAISE NOTICE '  - Add UI in /email-intake for quick replies';
  RAISE NOTICE '  - Implement keyboard shortcuts';
  RAISE NOTICE '  - Add template editor for customization';
END $$;
