import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createClient } from '@supabase/supabase-js'
import crypto from 'crypto'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const code = searchParams.get('code')
  const shop = searchParams.get('shop')
  const state = searchParams.get('state')
  const hmac = searchParams.get('hmac')

  // Log what we received for debugging
  console.log('Callback received:', {
    code: code ? 'present' : 'missing',
    shop: shop || 'missing',
    state: state ? 'present' : 'missing',
    hmac: hmac ? 'present' : 'missing',
    allParams: Array.from(searchParams.entries()),
  })

  // Verify required parameters
  if (!code || !shop || !state || !hmac) {
    return NextResponse.json({
      error: 'Missing required parameters',
      received: {
        code: !!code,
        shop: !!shop,
        state: !!state,
        hmac: !!hmac,
      }
    }, { status: 400 })
  }

  // Verify state matches (CSRF protection)
  const cookieStore = await cookies()
  const storedState = cookieStore.get('shopify_oauth_state')?.value

  if (!storedState || storedState !== state) {
    return NextResponse.json({ error: 'Invalid state parameter' }, { status: 400 })
  }

  // Verify HMAC
  const apiSecret = process.env.SHOPIFY_API_SECRET!
  const queryString = request.nextUrl.search
    .substring(1)
    .split('&')
    .filter((param) => !param.startsWith('hmac='))
    .sort()
    .join('&')

  const hash = crypto.createHmac('sha256', apiSecret).update(queryString).digest('hex')

  if (hash !== hmac) {
    return NextResponse.json({ error: 'Invalid HMAC signature' }, { status: 400 })
  }

  // Exchange code for access token
  const clientId = process.env.SHOPIFY_API_KEY!
  const clientSecret = process.env.SHOPIFY_API_SECRET!

  try {
    const tokenResponse = await fetch(`https://${shop}/admin/oauth/access_token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        client_id: clientId,
        client_secret: clientSecret,
        code,
      }),
    })

    if (!tokenResponse.ok) {
      throw new Error(`Token exchange failed: ${tokenResponse.statusText}`)
    }

    const tokenData = await tokenResponse.json()
    const { access_token, scope } = tokenData

    // Store credentials in database
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    const { error: dbError } = await supabase
      .from('shopify_credentials')
      .upsert(
        {
          shop,
          access_token,
          scope,
          updated_at: new Date().toISOString(),
        },
        {
          onConflict: 'shop',
        }
      )

    if (dbError) {
      console.error('Database error:', dbError)
      throw new Error(`Failed to store credentials: ${dbError.message}`)
    }

    // Clear state cookie
    cookieStore.delete('shopify_oauth_state')

    // Redirect to success page
    return NextResponse.redirect(`${process.env.NEXT_PUBLIC_APP_URL}/admin/import-orders?connected=true`)
  } catch (error) {
    console.error('OAuth callback error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'OAuth failed' },
      { status: 500 }
    )
  }
}
