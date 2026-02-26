import { NextResponse } from 'next/server'
import { registerWebhooks } from '@/lib/shopify/webhook-manager'

export async function POST() {
  try {
    await registerWebhooks()
    return NextResponse.json({
      success: true,
      message: 'Webhooks registered successfully'
    })
  } catch (error: any) {
    return NextResponse.json({
      success: false,
      error: error.message
    }, { status: 500 })
  }
}
