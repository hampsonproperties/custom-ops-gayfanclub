-- Seed Data for Custom Ops
-- Initial roles, templates, and settings

-- ============================================================================
-- ROLES
-- ============================================================================
INSERT INTO roles (key, name) VALUES
  ('admin', 'Administrator'),
  ('ops', 'Operations / Fulfillment'),
  ('support', 'Sales / Support')
ON CONFLICT (key) DO NOTHING;

-- ============================================================================
-- EMAIL TEMPLATES
-- ============================================================================
INSERT INTO templates (key, name, subject_template, body_html_template, merge_fields, is_active) VALUES

-- Design Fix Request Template
('design_fix_request', 'Design Fix Request',
'Your custom fan design needs a small adjustment',
'<p>Hi {{customer_name}},</p>

<p>Thanks so much for your custom fan order! We''ve reviewed your design and need a quick adjustment to ensure it prints beautifully.</p>

<p><strong>What we need:</strong><br>
{{fix_notes}}</p>

<p>Please reply to this email with your updated design file, or if you have questions, just let us know!</p>

<p><strong>Order Details:</strong></p>
<ul>
  <li>Order Number: {{order_number}}</li>
  <li>Quantity: {{quantity}}</li>
  <li>Grip Color: {{grip_color}}</li>
</ul>

<p>We''ll review it as soon as you send it over and get your fans into production!</p>

<p>Thanks,<br>
The Gay Fan Club Team 🌈</p>',
ARRAY['customer_name', 'fix_notes', 'order_number', 'quantity', 'grip_color'],
true),

-- New Inquiry Response Template
('new_inquiry_response', 'New Custom Inquiry Response',
'Custom fans for {{event_name}}',
'<p>Hi {{customer_name}}!</p>

<p>Thanks for reaching out about custom fans! We''d love to help make your {{event_type}} extra special.</p>

<p>Here''s what we need to get started:</p>
<ul>
  <li>How many fans do you need?</li>
  <li>What''s your event date?</li>
  <li>Do you have design ideas or artwork already?</li>
  <li>What grip color would you like? (Natural, White, Black, or Custom)</li>
</ul>

<p>Once we have these details, we can send you a quote and timeline!</p>

<p>Our typical process:</p>
<ol>
  <li>Design consultation & quote</li>
  <li>Design fee (if custom artwork needed)</li>
  <li>Proof approval</li>
  <li>Final payment & production</li>
  <li>Delivery 2-3 weeks before your event</li>
</ol>

<p>Looking forward to working with you!</p>

<p>Best,<br>
The Gay Fan Club Team 🌈</p>',
ARRAY['customer_name', 'event_name', 'event_type'],
true),

-- Design Fee Invoice Template
('design_fee_invoice', 'Design Fee Invoice',
'Design fee invoice for {{project_name}}',
'<p>Hi {{customer_name}},</p>

<p>Thanks for moving forward with your custom fan project!</p>

<p>To get started on your design, we need a design fee of <strong>{{design_fee_amount}}</strong>.</p>

<p><a href="{{invoice_link}}">Click here to pay your design fee</a></p>

<p>Once payment is received, our design team will begin working on your proof. You can expect to see it within 3-5 business days.</p>

<p><strong>Project Details:</strong></p>
<ul>
  <li>Project: {{project_name}}</li>
  <li>Quantity: {{quantity}}</li>
  <li>Event Date: {{event_date}}</li>
</ul>

<p>Excited to create something beautiful for you!</p>

<p>Thanks,<br>
The Gay Fan Club Team 🌈</p>',
ARRAY['customer_name', 'project_name', 'design_fee_amount', 'invoice_link', 'quantity', 'event_date'],
true),

-- Proof Sent Template
('proof_sent', 'Your Custom Fan Proof is Ready',
'Your custom fan proof is ready for review!',
'<p>Hi {{customer_name}}!</p>

<p>Great news - your custom fan proof is ready for review!</p>

<p><strong><a href="{{proof_link}}">Click here to view your proof</a></strong></p>

<p>Please review carefully and let us know:</p>
<ul>
  <li>✅ <strong>Approved!</strong> - We''ll send your final invoice and move to production</li>
  <li>✏️ <strong>Changes needed</strong> - Tell us what you''d like adjusted (minor tweaks included!)</li>
</ul>

<p><strong>Important:</strong> Please approve or request changes within 48 hours to keep your project on schedule for your {{event_date}} event.</p>

<p>Looking great so far!</p>

<p>The Gay Fan Club Team 🌈</p>',
ARRAY['customer_name', 'proof_link', 'event_date'],
true),

-- Final Invoice Template
('final_invoice', 'Final Invoice - Custom Fans',
'Final invoice for your custom fans',
'<p>Hi {{customer_name}}!</p>

<p>Your design is approved and we''re ready to move to production! 🎉</p>

<p><strong>Final Invoice: <a href="{{invoice_link}}">Click here to pay</a></strong></p>

<p><strong>Order Summary:</strong></p>
<ul>
  <li>Quantity: {{quantity}} custom fans</li>
  <li>Grip Color: {{grip_color}}</li>
  <li>Total: {{total_amount}}</li>
  <li>Estimated Delivery: {{estimated_delivery}}</li>
</ul>

<p>Once payment is received, we''ll get your fans into our production queue. Current turnaround is 2-3 weeks.</p>

<p>Thanks for choosing The Gay Fan Club!</p>

<p>Best,<br>
The Gay Fan Club Team 🌈</p>',
ARRAY['customer_name', 'invoice_link', 'quantity', 'grip_color', 'total_amount', 'estimated_delivery'],
true);

-- ============================================================================
-- SYSTEM SETTINGS
-- ============================================================================
INSERT INTO settings (key, value, description) VALUES

-- Custom Detection Rules
('custom_detection_rules',
'{
  "line_item_properties": ["customify", "design_preview", "design_download"],
  "product_keywords": ["Custom", "Custom Fan", "Customify"],
  "sku_patterns": ["CUSTOM-", "CF-"],
  "order_tags": ["custom", "customify"],
  "draft_order_titles": ["CUSTOM FAN PROJECT", "CUSTOM FAN (BULK ORDER)"]
}'::jsonb,
'Rules for detecting custom orders from Shopify'),

-- SLA Thresholds (in business hours)
('sla_thresholds',
'{
  "design_review_initial": 8,
  "design_review_resubmit": 8,
  "lead_response_initial": 8,
  "lead_response_active": 16,
  "batch_readiness": 16
}'::jsonb,
'SLA thresholds in business hours'),

-- Cadence Rules (in days)
('cadence_rules',
'{
  "new_inquiry": 1,
  "info_sent": 3,
  "design_fee_sent": 5,
  "proof_sent": 2,
  "invoice_sent": 3,
  "future_event_120_plus": 30,
  "future_event_60_120": 14,
  "future_event_30_60": 7,
  "future_event_under_30": 3
}'::jsonb,
'Follow-up cadence rules by status and event proximity'),

-- Business Days Configuration
('business_days',
'{
  "timezone": "America/Los_Angeles",
  "working_days": [1, 2, 3, 4, 5],
  "holidays": []
}'::jsonb,
'Business days and timezone configuration');
