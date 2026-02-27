import { NextRequest, NextResponse } from 'next/server'
import { lookupShopifyCustomer } from '@/lib/shopify/lookup-customer'

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const email = searchParams.get('email')

    if (!email) {
      return NextResponse.json(
        { error: 'Email parameter required' },
        { status: 400 }
      )
    }

    const result = await lookupShopifyCustomer(email)
    return NextResponse.json(result)
  } catch (error: any) {
    console.error('[API] Customer lookup error:', error)
    return NextResponse.json(
      { error: 'Failed to lookup customer', message: error.message },
      { status: 500 }
    )
  }
}
