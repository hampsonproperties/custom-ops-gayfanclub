/**
 * Shopify Order Sync API
 * Fetches orders from Shopify and stores them in the database
 * Matches customers by email address
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient as createAuthClient } from '@/lib/supabase/server'
import { createClient } from '@supabase/supabase-js'
import { getShopifyClient, createShopifySession } from '@/lib/shopify/client'
import { logger } from '@/lib/logger'
import { unauthorized, tooManyRequests, serverError } from '@/lib/api/errors'
import { SHOPIFY_API_VERSION } from '@/lib/config'

const log = logger('shopify-sync-orders')

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

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
    // Use auth client for authentication check
    const authClient = await createAuthClient()
    const { data: { user }, error: authError } = await authClient.auth.getUser()
    if (authError || !user) {
      return unauthorized('Unauthorized')
    }

    // Per-route rate limit: 5 syncs per hour per user (stricter than the general API tier)
    const rateLimitResult = checkRateLimit(user.id)
    if (!rateLimitResult.allowed) {
      return tooManyRequests('Rate limit exceeded. Please try again later.', rateLimitResult.resetIn)
    }

    // Use service role client for database operations (bypasses RLS)
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // Check if Shopify credentials are configured
    if (!process.env.SHOPIFY_API_KEY || !process.env.SHOPIFY_STORE_DOMAIN) {
      return serverError('Shopify credentials not configured')
    }

    // Fetch orders using direct Shopify Admin API (same pattern as import-orders)
    const shopifyDomain = process.env.SHOPIFY_STORE_DOMAIN!
    log.info('Starting order sync', { shopifyDomain })

    const credentials = await import('@/lib/shopify/get-credentials').then(m => m.getShopifyCredentials())
    const shopifyToken = credentials.accessToken
    log.info('Retrieved access token', { hasToken: !!shopifyToken })

    const params = new URLSearchParams({
      status: 'any',
      limit: '250',
    })

    const apiUrl = `https://${shopifyDomain}/admin/api/${SHOPIFY_API_VERSION}/orders.json?${params}`
    log.info('Fetching orders from Shopify', { apiUrl })

    const shopifyResponse = await fetch(apiUrl, {
      headers: {
        'X-Shopify-Access-Token': shopifyToken,
        'Content-Type': 'application/json',
      },
    })

    log.info('Shopify API responded', { status: shopifyResponse.status })

    if (!shopifyResponse.ok) {
      const errorText = await shopifyResponse.text()
      log.error('Shopify API error', { statusText: shopifyResponse.statusText, errorText })
      return serverError(`Shopify API error: ${shopifyResponse.statusText}`)
    }

    const data = await shopifyResponse.json()
    const orders = data.orders || []

    log.info('Fetched orders from Shopify', { count: orders.length })

    if (orders.length === 0) {
      return NextResponse.json({
        success: true,
        synced: 0,
        total: 0,
        matchedCustomers: 0,
        message: 'No orders found in Shopify'
      })
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
            .select('id, shopify_customer_id, first_name, last_name')
            .eq('email', order.email.toLowerCase())
            .single()

          if (customer) {
            customerId = customer.id
            matchedCustomers++

            // Fill in Shopify customer data if missing (fixes customers created from email)
            const shopifyCustomer = order.customer
            if (shopifyCustomer) {
              const updates: Record<string, any> = {}

              if (!customer.shopify_customer_id && shopifyCustomer.id) {
                updates.shopify_customer_id = shopifyCustomer.id.toString()
              }
              if (!customer.first_name && shopifyCustomer.first_name) {
                updates.first_name = shopifyCustomer.first_name
              }
              if (!customer.last_name && shopifyCustomer.last_name) {
                updates.last_name = shopifyCustomer.last_name
              }
              if ((!customer.first_name || !customer.last_name) && (shopifyCustomer.first_name || shopifyCustomer.last_name)) {
                const name = [shopifyCustomer.first_name, shopifyCustomer.last_name].filter(Boolean).join(' ')
                if (name) updates.display_name = name
              }

              if (Object.keys(updates).length > 0) {
                await supabase
                  .from('customers')
                  .update(updates)
                  .eq('id', customer.id)
                log.info('Updated customer with Shopify data', { customerId: customer.id, updates: Object.keys(updates) })
              }
            }
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
          log.error('Failed to sync order', { orderName: order.name, error })
          errors.push(`Order ${order.name}: Failed to sync`)
        } else {
          syncedCount++
        }
      } catch (orderError: any) {
        log.error('Error processing order', { orderName: order.name, error: orderError })
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
    log.error('Shopify sync error', { error })
    return serverError('An error occurred during synchronization')
  }
}
