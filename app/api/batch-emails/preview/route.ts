import { NextRequest, NextResponse } from 'next/server'
import { getAndRenderTemplate } from '@/lib/email/templates'

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const emailType = searchParams.get('type') || 'entering_production'
  const firstName = searchParams.get('firstName') || 'John'

  const validTypes = ['entering_production', 'midway_checkin', 'en_route', 'arrived_stateside']
  if (!validTypes.includes(emailType)) {
    return NextResponse.json(
      { error: `Invalid type. Must be one of: ${validTypes.join(', ')}` },
      { status: 400 }
    )
  }

  const templateMap: Record<string, string> = {
    entering_production: 'batch-entering-production',
    midway_checkin: 'batch-midway-checkin',
    en_route: 'batch-en-route',
    arrived_stateside: 'batch-arrived-stateside',
  }

  const templateKey = templateMap[emailType]!

  const rendered = await getAndRenderTemplate(templateKey, {
    first_name: firstName,
    shop_url: 'https://www.thegayfanclub.com',
    discount_code: 'WAIT20',
  })

  if (!rendered) {
    return NextResponse.json({ error: 'Template not found. Have you run migrations?' }, { status: 404 })
  }

  // Return HTML for preview in browser
  return new NextResponse(rendered.body, {
    headers: {
      'Content-Type': 'text/html',
    },
  })
}
