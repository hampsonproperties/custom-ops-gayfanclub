import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import crypto from 'crypto'

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const shop = searchParams.get('shop')

  if (!shop) {
    return NextResponse.json({ error: 'Missing shop parameter' }, { status: 400 })
  }

  const clientId = process.env.SHOPIFY_API_KEY!
  const redirectUri = `${process.env.NEXT_PUBLIC_APP_URL}/api/shopify/callback`
  const scopes = 'read_orders,read_products'

  // Generate random state for CSRF protection
  const state = crypto.randomBytes(16).toString('hex')

  // Store state in cookie
  const cookieStore = await cookies()
  cookieStore.set('shopify_oauth_state', state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 60 * 10, // 10 minutes
  })

  // Redirect to Shopify OAuth
  const authUrl = new URL(`https://${shop}/admin/oauth/authorize`)
  authUrl.searchParams.append('client_id', clientId)
  authUrl.searchParams.append('scope', scopes)
  authUrl.searchParams.append('redirect_uri', redirectUri)
  authUrl.searchParams.append('state', state)

  return NextResponse.redirect(authUrl.toString())
}
