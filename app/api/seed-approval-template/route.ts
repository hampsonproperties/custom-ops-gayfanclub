import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

export async function POST(request: NextRequest) {
  try {
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // Insert or update the customify-proof-approval template
    const { data, error } = await supabase
      .from('templates')
      .upsert({
        key: 'customify-proof-approval',
        name: 'Customify Proof Approval Email',
        subject_template: 'Your Custom Fan Order #{{orderNumber}} - Design Ready for Approval',
        body_html_template: `<!DOCTYPE html>
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
    <p style="margin: 0;">If you have any questions or need changes to the design, simply reply to this email and we'll get back to you right away!</p>
    <p style="margin: 10px 0 0 0;">Thanks for choosing The Gay Fan Club! 🏳️‍🌈</p>
  </div>

  <div style="text-align: center; margin-top: 30px; padding-top: 20px; border-top: 1px solid #e5e7eb; font-size: 12px; color: #9ca3af;">
    <p>The Gay Fan Club<br>
    <a href="mailto:sales@thegayfanclub.com" style="color: #2563eb;">sales@thegayfanclub.com</a></p>
  </div>
</body>
</html>`,
        merge_fields: ['customerName', 'orderNumber', 'proofImageUrl', 'approveLink', 'rejectLink'],
        is_active: true,
      })
      .select()

    if (error) {
      console.error('Failed to seed template:', error)
      return NextResponse.json(
        { error: 'Failed to seed template', details: error.message },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      message: 'Template seeded successfully',
      template: data,
    })
  } catch (error) {
    console.error('Seed template error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to seed template' },
      { status: 500 }
    )
  }
}
