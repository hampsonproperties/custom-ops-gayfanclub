import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

export async function GET() {
  try {
    const supabase = createClient(supabaseUrl, supabaseServiceKey)
    const shopDomain = process.env.SHOPIFY_STORE_DOMAIN

    if (!shopDomain) {
      return NextResponse.json({
        connected: false,
        error: 'SHOPIFY_STORE_DOMAIN not set in environment variables',
      })
    }

    // Check if credentials exist
    const { data, error } = await supabase
      .from('shopify_credentials')
      .select('shop, scope, created_at, updated_at')
      .eq('shop', shopDomain)
      .single()

    if (error || !data) {
      return NextResponse.json({
        connected: false,
        shopDomain,
        error: error?.message || 'No credentials found',
        installUrl: `/api/shopify/install?shop=${shopDomain}`,
      })
    }

    return NextResponse.json({
      connected: true,
      shop: data.shop,
      scope: data.scope,
      createdAt: data.created_at,
      updatedAt: data.updated_at,
    })
  } catch (error) {
    return NextResponse.json(
      {
        connected: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}
