import { NextRequest, NextResponse } from 'next/server'
import { fetchOrderComments } from '@/lib/shopify/fetch-order-comments'

export async function GET(request: NextRequest) {
  const orderId = request.nextUrl.searchParams.get('orderId') || '5982467211442'

  try {
    const comments = await fetchOrderComments(orderId)
    return NextResponse.json({
      success: true,
      orderId,
      count: comments.length,
      comments,
    })
  } catch (error: any) {
    return NextResponse.json({
      success: false,
      error: error.message,
      stack: error.stack,
    }, { status: 500 })
  }
}
