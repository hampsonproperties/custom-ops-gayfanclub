-- Add batch email templates to templates table
-- These templates are used for automated batch progress notifications

-- Email 1: Entering Production (1 day after batch confirmed)
INSERT INTO templates (key, name, subject_template, body_html_template, merge_fields, is_active)
VALUES (
  'batch-entering-production',
  'Batch Email 1: Entering Production',
  'Your custom fan is officially in production ⚡',
  '<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Your custom fan is in production</title>
</head>
<body style="margin: 0; padding: 0; background-color: #f5f5f5; font-family: -apple-system, BlinkMacSystemFont, ''Segoe UI'', Arial, sans-serif;">
  <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background-color: #f5f5f5;">
    <tr>
      <td style="padding: 20px 0;">
        <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="600" style="margin: 0 auto; background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">

          <!-- Black Header with Free Shipping Banner -->
          <tr>
            <td style="background-color: #000000; padding: 12px 20px; text-align: center; border-bottom: 3px solid #ff0080;">
              <p style="margin: 0; color: #ffffff; font-size: 12px; font-weight: 600; letter-spacing: 1px;">
                FREE ✈ SHIPPING ON ALL ORDERS
              </p>
            </td>
          </tr>

          <!-- Logo Section -->
          <tr>
            <td style="padding: 30px 40px 20px; text-align: center;">
              <img src="https://www.thegayfanclub.com/cdn/shop/files/TGFC_Logo_Black.png?v=1761155178&width=360" alt="The Gay Fan Club" style="max-width: 180px; height: auto;" />
            </td>
          </tr>

          <!-- Main Content -->
          <tr>
            <td style="padding: 0 40px 30px;">
              <h2 style="color: #ff0080; margin: 0 0 20px 0; font-size: 28px; font-weight: 700; line-height: 1.2;">
                Big news — your custom fan is officially in production ⚡
              </h2>

              <p style="margin: 0 0 16px 0; color: #333333; font-size: 16px; line-height: 1.6;">
                Hi {{first_name}},
              </p>

              <p style="margin: 0 0 16px 0; color: #333333; font-size: 16px; line-height: 1.6;">
                That means it's now locked into our next manufacturing batch, where it will be printed, assembled, and brought to life from start to clack.
              </p>

              <p style="margin: 0 0 16px 0; color: #333333; font-size: 16px; line-height: 1.6;">
                Most custom orders arrive within about <strong>30 days</strong>, and we'll keep you updated at every major step as it makes its way to our U.S. warehouse.
              </p>

              <!-- Discount Promo Box -->
              <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); border-radius: 8px; padding: 25px; margin: 30px 0; text-align: center;">
                <p style="margin: 0 0 12px 0; color: #ffffff; font-size: 18px; font-weight: 700;">
                  While your fan is being made, here's a little bonus if you want something ready-to-ship right now:
                </p>
                <p style="margin: 0 0 20px 0; color: #ffffff; font-size: 32px; font-weight: 900; letter-spacing: 2px;">
                  WAIT20
                </p>
                <p style="margin: 0; color: #ffffff; font-size: 14px;">
                  Take 20% off any in-stock fan
                </p>
              </div>

              <!-- CTA Buttons -->
              <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="margin: 25px 0;">
                <tr>
                  <td style="padding: 0 5px 10px 0;" width="50%">
                    <a href="https://www.thegayfanclub.com/collections/fan-faves" style="display: block; background-color: #000000; color: #ffffff; text-decoration: none; padding: 16px 20px; border-radius: 6px; font-weight: 700; text-align: center; font-size: 14px; letter-spacing: 0.5px;">
                      → SHOP FAN FAVES
                    </a>
                  </td>
                  <td style="padding: 0 0 10px 5px;" width="50%">
                    <a href="https://www.thegayfanclub.com/collections/50-off-sale" style="display: block; background-color: #ff0080; color: #ffffff; text-decoration: none; padding: 16px 20px; border-radius: 6px; font-weight: 700; text-align: center; font-size: 14px; letter-spacing: 0.5px;">
                      → SHOP 50% OFF SALE
                    </a>
                  </td>
                </tr>
              </table>

              <p style="margin: 20px 0 0 0; color: #333333; font-size: 16px; line-height: 1.6;">
                Thanks again for your patience — <strong>custom is always worth the wait.</strong>
              </p>

              <p style="margin: 20px 0 0 0; color: #333333; font-size: 16px; line-height: 1.6;">
                — The Gay Fan Club Team 🏳️‍🌈
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background-color: #f8f9fa; padding: 20px 40px; text-align: center; border-top: 1px solid #e5e7eb;">
              <p style="margin: 0 0 5px 0; font-size: 12px; color: #6b7280;">
                The Gay Fan Club
              </p>
              <p style="margin: 0; font-size: 12px; color: #6b7280;">
                <a href="mailto:sales@thegayfanclub.com" style="color: #ff0080; text-decoration: none;">sales@thegayfanclub.com</a>
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>',
  ARRAY['first_name', 'shop_url', 'discount_code'],
  true
)
ON CONFLICT (key) DO UPDATE SET
  name = EXCLUDED.name,
  subject_template = EXCLUDED.subject_template,
  body_html_template = EXCLUDED.body_html_template,
  merge_fields = EXCLUDED.merge_fields,
  is_active = EXCLUDED.is_active,
  updated_at = NOW();

-- Email 2: Midway Check-In (10 days after batch confirmed)
INSERT INTO templates (key, name, subject_template, body_html_template, merge_fields, is_active)
VALUES (
  'batch-midway-checkin',
  'Batch Email 2: Midway Check-In',
  'Quick custom update — everything's on track ✅',
  '<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Your custom fan update</title>
</head>
<body style="margin: 0; padding: 0; background-color: #f5f5f5; font-family: -apple-system, BlinkMacSystemFont, ''Segoe UI'', Arial, sans-serif;">
  <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background-color: #f5f5f5;">
    <tr>
      <td style="padding: 20px 0;">
        <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="600" style="margin: 0 auto; background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">

          <!-- Black Header -->
          <tr>
            <td style="background-color: #000000; padding: 12px 20px; text-align: center; border-bottom: 3px solid #00d4aa;">
              <p style="margin: 0; color: #ffffff; font-size: 12px; font-weight: 600; letter-spacing: 1px;">
                FREE ✈ SHIPPING ON ALL ORDERS
              </p>
            </td>
          </tr>

          <!-- Logo Section -->
          <tr>
            <td style="padding: 30px 40px 20px; text-align: center;">
              <img src="https://www.thegayfanclub.com/cdn/shop/files/TGFC_Logo_Black.png?v=1761155178&width=360" alt="The Gay Fan Club" style="max-width: 180px; height: auto;" />
            </td>
          </tr>

          <!-- Main Content -->
          <tr>
            <td style="padding: 0 40px 30px;">
              <h2 style="color: #00d4aa; margin: 0 0 20px 0; font-size: 28px; font-weight: 700; line-height: 1.2;">
                Quick check-in — everything's on track ✅
              </h2>

              <p style="margin: 0 0 16px 0; color: #333333; font-size: 16px; line-height: 1.6;">
                Hi {{first_name}},
              </p>

              <p style="margin: 0 0 16px 0; color: #333333; font-size: 16px; line-height: 1.6;">
                Just a quick check-in — your custom fan is moving through production right on schedule.
              </p>

              <p style="margin: 0 0 16px 0; color: #333333; font-size: 16px; line-height: 1.6;">
                This is the behind-the-scenes phase where each batch is printed, assembled, and packed before heading to our U.S. facility.
              </p>

              <p style="margin: 0 0 16px 0; color: #333333; font-size: 16px; line-height: 1.6;">
                <strong>Next major step is international transit</strong>, and we'll let you know the moment it's officially on the move.
              </p>

              <!-- Status Box -->
              <div style="background-color: #f0fdf4; border-left: 4px solid #00d4aa; padding: 20px; margin: 25px 0; border-radius: 4px;">
                <p style="margin: 0; color: #065f46; font-size: 15px; font-weight: 600;">
                  ✓ Design approved<br>
                  ✓ Batch locked in<br>
                  ✓ Currently in production<br>
                  → Next: International transit
                </p>
              </div>

              <!-- Discount Promo Box -->
              <div style="background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%); border-radius: 8px; padding: 25px; margin: 30px 0; text-align: center;">
                <p style="margin: 0 0 12px 0; color: #ffffff; font-size: 16px; font-weight: 600;">
                  In the meantime, your custom-order perk is still active:
                </p>
                <p style="margin: 0 0 20px 0; color: #ffffff; font-size: 32px; font-weight: 900; letter-spacing: 2px;">
                  WAIT20
                </p>
                <p style="margin: 0; color: #ffffff; font-size: 14px;">
                  20% off ready-to-ship fans
                </p>
              </div>

              <!-- CTA Buttons -->
              <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="margin: 25px 0;">
                <tr>
                  <td style="padding: 0 5px 10px 0;" width="50%">
                    <a href="https://www.thegayfanclub.com/collections/fan-faves" style="display: block; background-color: #000000; color: #ffffff; text-decoration: none; padding: 16px 20px; border-radius: 6px; font-weight: 700; text-align: center; font-size: 14px; letter-spacing: 0.5px;">
                      → SHOP FAN FAVES
                    </a>
                  </td>
                  <td style="padding: 0 0 10px 5px;" width="50%">
                    <a href="https://www.thegayfanclub.com/collections/50-off-sale" style="display: block; background-color: #00d4aa; color: #ffffff; text-decoration: none; padding: 16px 20px; border-radius: 6px; font-weight: 700; text-align: center; font-size: 14px; letter-spacing: 0.5px;">
                      → SHOP 50% OFF SALE
                    </a>
                  </td>
                </tr>
              </table>

              <p style="margin: 20px 0 0 0; color: #333333; font-size: 16px; line-height: 1.6;">
                Thanks for hanging with us — <strong>it's going to be so worth it.</strong>
              </p>

              <p style="margin: 20px 0 0 0; color: #333333; font-size: 16px; line-height: 1.6;">
                — The Gay Fan Club Team 🏳️‍🌈
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background-color: #f8f9fa; padding: 20px 40px; text-align: center; border-top: 1px solid #e5e7eb;">
              <p style="margin: 0 0 5px 0; font-size: 12px; color: #6b7280;">
                The Gay Fan Club
              </p>
              <p style="margin: 0; font-size: 12px; color: #6b7280;">
                <a href="mailto:sales@thegayfanclub.com" style="color: #00d4aa; text-decoration: none;">sales@thegayfanclub.com</a>
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>',
  ARRAY['first_name', 'shop_url', 'discount_code'],
  true
)
ON CONFLICT (key) DO UPDATE SET
  name = EXCLUDED.name,
  subject_template = EXCLUDED.subject_template,
  body_html_template = EXCLUDED.body_html_template,
  merge_fields = EXCLUDED.merge_fields,
  is_active = EXCLUDED.is_active,
  updated_at = NOW();

-- Email 3: En Route (when tracking number added)
INSERT INTO templates (key, name, subject_template, body_html_template, merge_fields, is_active)
VALUES (
  'batch-en-route',
  'Batch Email 3: Completed & En Route',
  'Your custom fan is finished and on the move ✈️',
  '<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Your custom fan is en route</title>
</head>
<body style="margin: 0; padding: 0; background-color: #f5f5f5; font-family: -apple-system, BlinkMacSystemFont, ''Segoe UI'', Arial, sans-serif;">
  <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background-color: #f5f5f5;">
    <tr>
      <td style="padding: 20px 0;">
        <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="600" style="margin: 0 auto; background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">

          <!-- Black Header -->
          <tr>
            <td style="background-color: #000000; padding: 12px 20px; text-align: center; border-bottom: 3px solid #fbbf24;">
              <p style="margin: 0; color: #ffffff; font-size: 12px; font-weight: 600; letter-spacing: 1px;">
                FREE ✈ SHIPPING ON ALL ORDERS
              </p>
            </td>
          </tr>

          <!-- Logo Section -->
          <tr>
            <td style="padding: 30px 40px 20px; text-align: center;">
              <img src="https://www.thegayfanclub.com/cdn/shop/files/TGFC_Logo_Black.png?v=1761155178&width=360" alt="The Gay Fan Club" style="max-width: 180px; height: auto;" />
            </td>
          </tr>

          <!-- Main Content -->
          <tr>
            <td style="padding: 0 40px 30px;">
              <h2 style="color: #f59e0b; margin: 0 0 20px 0; font-size: 28px; font-weight: 700; line-height: 1.2;">
                Good news — your custom fan is finished and on the move ✈️
              </h2>

              <p style="margin: 0 0 16px 0; color: #333333; font-size: 16px; line-height: 1.6;">
                Hi {{first_name}},
              </p>

              <p style="margin: 0 0 16px 0; color: #333333; font-size: 16px; line-height: 1.6;">
                Your custom fan has officially <strong>completed production</strong> and is now en route to our U.S. warehouse.
              </p>

              <p style="margin: 0 0 16px 0; color: #333333; font-size: 16px; line-height: 1.6;">
                It's currently traveling internationally, and once it arrives stateside, we'll prep it for final shipment to you immediately.
              </p>

              <p style="margin: 0 0 16px 0; color: #333333; font-size: 18px; font-weight: 700; line-height: 1.6;">
                You're in the home stretch. 🎉
              </p>

              <!-- Progress Box -->
              <div style="background: linear-gradient(135deg, #fef3c7 0%, #fcd34d 100%); border-radius: 8px; padding: 25px; margin: 30px 0; text-align: center;">
                <p style="margin: 0 0 15px 0; color: #78350f; font-size: 16px; font-weight: 700;">
                  ORDER STATUS
                </p>
                <p style="margin: 0; color: #78350f; font-size: 15px; line-height: 1.8; font-weight: 600;">
                  ✓ Design approved<br>
                  ✓ Production completed<br>
                  ✓ International transit<br>
                  → Next: Arrival at U.S. warehouse
                </p>
              </div>

              <!-- Discount Promo Box -->
              <div style="background: linear-gradient(135deg, #a78bfa 0%, #ec4899 100%); border-radius: 8px; padding: 25px; margin: 30px 0; text-align: center;">
                <p style="margin: 0 0 12px 0; color: #ffffff; font-size: 16px; font-weight: 600;">
                  As a thank-you for going custom, here's 20% off anything ready-to-ship while you wait:
                </p>
                <p style="margin: 0 0 20px 0; color: #ffffff; font-size: 32px; font-weight: 900; letter-spacing: 2px;">
                  WAIT20
                </p>
              </div>

              <!-- CTA Buttons -->
              <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="margin: 25px 0;">
                <tr>
                  <td style="padding: 0 5px 10px 0;" width="50%">
                    <a href="https://www.thegayfanclub.com/collections/new-hand-fans" style="display: block; background-color: #000000; color: #ffffff; text-decoration: none; padding: 16px 20px; border-radius: 6px; font-weight: 700; text-align: center; font-size: 14px; letter-spacing: 0.5px;">
                      → SHOP NEW ARRIVALS
                    </a>
                  </td>
                  <td style="padding: 0 0 10px 5px;" width="50%">
                    <a href="https://www.thegayfanclub.com/collections/50-off-sale" style="display: block; background-color: #f59e0b; color: #ffffff; text-decoration: none; padding: 16px 20px; border-radius: 6px; font-weight: 700; text-align: center; font-size: 14px; letter-spacing: 0.5px;">
                      → SHOP 50% OFF SALE
                    </a>
                  </td>
                </tr>
              </table>

              <p style="margin: 20px 0 0 0; color: #333333; font-size: 16px; line-height: 1.6;">
                Can't wait for you to have it in hand.
              </p>

              <p style="margin: 20px 0 0 0; color: #333333; font-size: 16px; line-height: 1.6;">
                — The Gay Fan Club Team 🏳️‍🌈
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background-color: #f8f9fa; padding: 20px 40px; text-align: center; border-top: 1px solid #e5e7eb;">
              <p style="margin: 0 0 5px 0; font-size: 12px; color: #6b7280;">
                The Gay Fan Club
              </p>
              <p style="margin: 0; font-size: 12px; color: #6b7280;">
                <a href="mailto:sales@thegayfanclub.com" style="color: #f59e0b; text-decoration: none;">sales@thegayfanclub.com</a>
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>',
  ARRAY['first_name', 'shop_url', 'discount_code'],
  true
)
ON CONFLICT (key) DO UPDATE SET
  name = EXCLUDED.name,
  subject_template = EXCLUDED.subject_template,
  body_html_template = EXCLUDED.body_html_template,
  merge_fields = EXCLUDED.merge_fields,
  is_active = EXCLUDED.is_active,
  updated_at = NOW();

-- Email 4: Arrived Stateside (when batch marked as received at warehouse)
INSERT INTO templates (key, name, subject_template, body_html_template, merge_fields, is_active)
VALUES (
  'batch-arrived-stateside',
  'Batch Email 4: Arrived Stateside',
  'Arrived in the U.S. — shipping soon 📦',
  '<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Your custom fan has arrived in the U.S.</title>
</head>
<body style="margin: 0; padding: 0; background-color: #f5f5f5; font-family: -apple-system, BlinkMacSystemFont, ''Segoe UI'', Arial, sans-serif;">
  <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background-color: #f5f5f5;">
    <tr>
      <td style="padding: 20px 0;">
        <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="600" style="margin: 0 auto; background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">

          <!-- Black Header -->
          <tr>
            <td style="background-color: #000000; padding: 12px 20px; text-align: center; border-bottom: 3px solid #10b981;">
              <p style="margin: 0; color: #ffffff; font-size: 12px; font-weight: 600; letter-spacing: 1px;">
                FREE ✈ SHIPPING ON ALL ORDERS
              </p>
            </td>
          </tr>

          <!-- Logo Section -->
          <tr>
            <td style="padding: 30px 40px 20px; text-align: center;">
              <img src="https://www.thegayfanclub.com/cdn/shop/files/TGFC_Logo_Black.png?v=1761155178&width=360" alt="The Gay Fan Club" style="max-width: 180px; height: auto;" />
            </td>
          </tr>

          <!-- Main Content -->
          <tr>
            <td style="padding: 0 40px 30px;">
              <h2 style="color: #10b981; margin: 0 0 20px 0; font-size: 28px; font-weight: 700; line-height: 1.2;">
                It's here — your custom fan has arrived 📦
              </h2>

              <p style="margin: 0 0 16px 0; color: #333333; font-size: 16px; line-height: 1.6;">
                Hi {{first_name}},
              </p>

              <p style="margin: 0 0 16px 0; color: #333333; font-size: 16px; line-height: 1.6;">
                Your custom fan has officially arrived at our U.S. warehouse.
              </p>

              <p style="margin: 0 0 16px 0; color: #333333; font-size: 16px; line-height: 1.6;">
                We're now completing final prep and packaging, and you'll receive <strong>shipment confirmation with tracking</strong> very soon.
              </p>

              <!-- Success Box -->
              <div style="background: linear-gradient(135deg, #d1fae5 0%, #a7f3d0 100%); border-radius: 8px; padding: 30px; margin: 30px 0; text-align: center;">
                <p style="margin: 0 0 15px 0; color: #065f46; font-size: 48px;">
                  🎉
                </p>
                <p style="margin: 0; color: #065f46; font-size: 15px; line-height: 1.8; font-weight: 600;">
                  ✓ Production completed<br>
                  ✓ International transit completed<br>
                  ✓ Arrived at U.S. warehouse<br>
                  → Next: Shipping to you!
                </p>
              </div>

              <!-- Final Discount Promo -->
              <div style="background: linear-gradient(135deg, #4ade80 0%, #3b82f6 100%); border-radius: 8px; padding: 25px; margin: 30px 0; text-align: center;">
                <p style="margin: 0 0 12px 0; color: #ffffff; font-size: 16px; font-weight: 600;">
                  Last chance to use your custom-order bonus before it ships:
                </p>
                <p style="margin: 0 0 20px 0; color: #ffffff; font-size: 32px; font-weight: 900; letter-spacing: 2px;">
                  WAIT20
                </p>
                <p style="margin: 0; color: #ffffff; font-size: 14px;">
                  20% off in-stock fans
                </p>
              </div>

              <!-- CTA Buttons -->
              <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="margin: 25px 0;">
                <tr>
                  <td style="padding: 0 5px 10px 0;" width="50%">
                    <a href="https://www.thegayfanclub.com/collections/fan-faves" style="display: block; background-color: #000000; color: #ffffff; text-decoration: none; padding: 16px 20px; border-radius: 6px; font-weight: 700; text-align: center; font-size: 14px; letter-spacing: 0.5px;">
                      → SHOP FAN FAVES
                    </a>
                  </td>
                  <td style="padding: 0 0 10px 5px;" width="50%">
                    <a href="https://www.thegayfanclub.com/collections/50-off-sale" style="display: block; background-color: #10b981; color: #ffffff; text-decoration: none; padding: 16px 20px; border-radius: 6px; font-weight: 700; text-align: center; font-size: 14px; letter-spacing: 0.5px;">
                      → SHOP 50% OFF SALE
                    </a>
                  </td>
                </tr>
              </table>

              <p style="margin: 20px 0 0 0; color: #333333; font-size: 16px; line-height: 1.6;">
                Thanks again — <strong>we can't wait for you to clack loud with this one.</strong>
              </p>

              <p style="margin: 20px 0 0 0; color: #333333; font-size: 16px; line-height: 1.6;">
                — The Gay Fan Club Team 🏳️‍🌈
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background-color: #f8f9fa; padding: 20px 40px; text-align: center; border-top: 1px solid #e5e7eb;">
              <p style="margin: 0 0 5px 0; font-size: 12px; color: #6b7280;">
                The Gay Fan Club
              </p>
              <p style="margin: 0; font-size: 12px; color: #6b7280;">
                <a href="mailto:sales@thegayfanclub.com" style="color: #10b981; text-decoration: none;">sales@thegayfanclub.com</a>
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>',
  ARRAY['first_name', 'shop_url', 'discount_code'],
  true
)
ON CONFLICT (key) DO UPDATE SET
  name = EXCLUDED.name,
  subject_template = EXCLUDED.subject_template,
  body_html_template = EXCLUDED.body_html_template,
  merge_fields = EXCLUDED.merge_fields,
  is_active = EXCLUDED.is_active,
  updated_at = NOW();

-- Add comment
COMMENT ON TABLE templates IS 'Email templates with merge field support. Used for automated emails like batch progress notifications and approval emails.';
