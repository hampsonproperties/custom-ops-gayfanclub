/**
 * Shopify Order Sync API
 * Fetches orders from Shopify and stores them in the database
 * Matches customers by email address
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getShopifyClient, createShopifySession } from '@/lib/shopify/client'

// Simple in-memory rate limiter
// Map of userId -> array of sync timestamps
const syncAttempts = new Map<string, number[]>()

// Rate limit: 5 syncs per hour per user
const RATE_LIMIT_WINDOW = 60 * 60 * 1000 // 1 hour in milliseconds
const RATE_LIMIT_MAX = 5

function checkRateLimit(userId: string): { allowed: boolean; resetIn?: number } {
  const now = Date.now()
  const userAttempts = syncAttempts.get(userId) || []

  // Remove attempts outside the time window
  const recentAttempts = userAttempts.filter(timestamp => now - timestamp < RATE_LIMIT_WINDOW)

  if (recentAttempts.length >= RATE_LIMIT_MAX) {
    const oldestAttempt = Math.min(...recentAttempts)
    const resetIn = Math.ceil((oldestAttempt + RATE_LIMIT_WINDOW - now) / 1000) // seconds
    return { allowed: false, resetIn }
  }

  // Add current attempt and update map
  recentAttempts.push(now)
  syncAttempts.set(userId, recentAttempts)

  return { allowed: true }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()

    // Auth check - only authenticated users can trigger sync
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Rate limiting check
    const rateLimitResult = checkRateLimit(user.id)
    if (!rateLimitResult.allowed) {
      return NextResponse.json(
        {
          error: 'Rate limit exceeded. Please try again later.',
          resetIn: rateLimitResult.resetIn
        },
        {
          status: 429,
          headers: {
            'Retry-After': rateLimitResult.resetIn?.toString() || '3600'
          }
        }
      )
    }

    // Check if Shopify credentials are configured
    if (!process.env.SHOPIFY_API_KEY || !process.env.SHOPIFY_STORE_DOMAIN) {
      return NextResponse.json(
        { error: 'Shopify credentials not configured' },
        { status: 500 }
      )
    }

    // Create Shopify session (fetches access token from database)
    const session = await createShopifySession()
    const shopify = getShopifyClient()
    const client = new shopify.clients.Rest({ session })

    // Fetch orders from Shopify (last 250, can paginate later if needed)
    const response = await client.get({
      path: 'orders',
      query: {
        status: 'any',
        limit: '250',
        fields: 'id,name,email,total_price,subtotal_price,total_tax,currency,financial_status,fulfillment_status,line_items,created_at,updated_at'
      },
    })

    const orders = (response.body as any).orders

    if (!orders || !Array.isArray(orders)) {
      return NextResponse.json(
        { error: 'No orders returned from Shopify' },
        { status: 500 }
      )
    }

    let syncedCount = 0
    let matchedCustomers = 0
    let errors: string[] = []

    for (const order of orders) {
      try {
        // Try to match customer by email
        let customerId = null
        if (order.email) {
          const { data: customer } = await supabase
            .from('customers')
            .select('id')
            .eq('email', order.email.toLowerCase())
            .single()

          if (customer) {
            customerId = customer.id
            matchedCustomers++
          }
        }

        // Upsert order (insert or update if exists)
        const { error } = await supabase
          .from('shopify_orders')
          .upsert({
            shopify_order_id: order.id.toString(),
            shopify_order_number: order.name,
            customer_id: customerId,
            customer_email: order.email?.toLowerCase() || '',
            total_price: parseFloat(order.total_price || '0'),
            subtotal_price: parseFloat(order.subtotal_price || '0'),
            total_tax: parseFloat(order.total_tax || '0'),
            currency: order.currency || 'USD',
            financial_status: order.financial_status,
            fulfillment_status: order.fulfillment_status,
            line_items: order.line_items || [],
            created_at: order.created_at,
            updated_at: order.updated_at || new Date().toISOString(),
            order_data: order
          }, {
            onConflict: 'shopify_order_id'
          })

        if (error) {
          console.error(`Failed to sync order ${order.name}:`, error)
          errors.push(`Order ${order.name}: Failed to sync`)
        } else {
          syncedCount++
        }
      } catch (orderError: any) {
        console.error(`Error processing order ${order.name}:`, orderError)
        errors.push(`Order ${order.name}: Processing error`)
      }
    }

    return NextResponse.json({
      success: true,
      synced: syncedCount,
      total: orders.length,
      matchedCustomers,
      errors: errors.length > 0 ? errors : undefined
    })

  } catch (error: any) {
    console.error('Shopify sync error:', error)
    return NextResponse.json(
      { error: 'An error occurred during synchronization' },
      { status: 500 }
    )
  }
}
