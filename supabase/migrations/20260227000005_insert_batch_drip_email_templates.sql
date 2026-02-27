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
