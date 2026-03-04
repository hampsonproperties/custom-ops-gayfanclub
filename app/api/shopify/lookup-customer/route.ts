import { NextRequest, NextResponse } from 'next/server'
import { lookupShopifyCustomer } from '@/lib/shopify/lookup-customer'
import { logger } from '@/lib/logger'
import { badRequest } from '@/lib/api/errors'

const log = logger('shopify-lookup-customer')

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const email = searchParams.get('email')

    if (!email) {
      return badRequest('Email parameter required')
    }

    const result = await lookupShopifyCustomer(email)
    return NextResponse.json(result)
  } catch (error: any) {
    log.error('Customer lookup error', { error })
    return NextResponse.json(
      { error: 'Failed to lookup customer', message: error.message },
      { status: 500 }
    )
  }
}
