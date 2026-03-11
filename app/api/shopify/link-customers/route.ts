/**
 * Bulk Link Customers to Shopify
 * Fetches Shopify customers, matches by email, and fills in missing data.
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient as createAuthClient } from '@/lib/supabase/server'
import { createClient } from '@supabase/supabase-js'
import { logger } from '@/lib/logger'
import { unauthorized, serverError } from '@/lib/api/errors'
import { SHOPIFY_API_VERSION } from '@/lib/config'

const log = logger('shopify-link-customers')

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

export async function POST(request: NextRequest) {
  try {
    const authClient = await createAuthClient()
    const { data: { user }, error: authError } = await authClient.auth.getUser()
    if (authError || !user) {
      return unauthorized('Unauthorized')
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    if (!process.env.SHOPIFY_API_KEY || !process.env.SHOPIFY_STORE_DOMAIN) {
      return serverError('Shopify credentials not configured')
    }

    const shopifyDomain = process.env.SHOPIFY_STORE_DOMAIN!
    const credentials = await import('@/lib/shopify/get-credentials').then(m => m.getShopifyCredentials())
    const shopifyToken = credentials.accessToken

    // 1. Fetch customers from our DB who are missing shopify_customer_id
    const { data: unlinked, error: dbError } = await supabase
      .from('customers')
      .select('id, email, first_name, last_name, display_name, phone, shopify_customer_id')
      .is('shopify_customer_id', null)
      .not('email', 'is', null)
      .neq('email', '')
      .limit(500)

    if (dbError) throw dbError
    if (!unlinked || unlinked.length === 0) {
      return NextResponse.json({ success: true, linked: 0, total: 0, message: 'All customers already linked' })
    }

    log.info('Found unlinked customers', { count: unlinked.length })

    // 2. Fetch all Shopify customers (paginate)
    const shopifyCustomers: any[] = []
    let pageInfo: string | null = null
    let hasNextPage = true

    while (hasNextPage) {
      const url: string = pageInfo
        ? `https://${shopifyDomain}/admin/api/${SHOPIFY_API_VERSION}/customers.json?limit=250&page_info=${pageInfo}`
        : `https://${shopifyDomain}/admin/api/${SHOPIFY_API_VERSION}/customers.json?limit=250`

      const resp: Response = await fetch(url, {
        headers: {
          'X-Shopify-Access-Token': shopifyToken,
          'Content-Type': 'application/json',
        },
      })

      if (!resp.ok) {
        log.error('Shopify customers API error', { status: resp.status })
        break
      }

      const data = await resp.json()
      shopifyCustomers.push(...(data.customers || []))

      // Parse Link header for pagination
      const linkHeader: string | null = resp.headers.get('Link')
      if (linkHeader && linkHeader.includes('rel="next"')) {
        const match: RegExpMatchArray | null = linkHeader.match(/<[^>]*page_info=([^>&>]+)[^>]*>;\s*rel="next"/)
        pageInfo = match ? match[1] : null
        hasNextPage = !!pageInfo
      } else {
        hasNextPage = false
      }
    }

    log.info('Fetched Shopify customers', { count: shopifyCustomers.length })

    // 3. Build email → Shopify customer map
    const shopifyByEmail = new Map<string, any>()
    for (const sc of shopifyCustomers) {
      if (sc.email) {
        shopifyByEmail.set(sc.email.toLowerCase(), sc)
      }
    }

    // 4. Match and update
    let linked = 0
    for (const customer of unlinked) {
      if (!customer.email) continue
      const shopifyCustomer = shopifyByEmail.get(customer.email.toLowerCase())
      if (!shopifyCustomer) continue

      const updates: Record<string, any> = {
        shopify_customer_id: shopifyCustomer.id.toString(),
      }
      if (!customer.first_name && shopifyCustomer.first_name) {
        updates.first_name = shopifyCustomer.first_name
      }
      if (!customer.last_name && shopifyCustomer.last_name) {
        updates.last_name = shopifyCustomer.last_name
      }
      // Backfill display_name if missing OR if it's just the email address
      const shopifyFullName = [shopifyCustomer.first_name, shopifyCustomer.last_name].filter(Boolean).join(' ')
      const displayNameIsEmail = customer.display_name && customer.display_name === customer.email
      if ((!customer.display_name || displayNameIsEmail) && shopifyFullName) {
        updates.display_name = shopifyFullName
      }
      if (!customer.phone && shopifyCustomer.phone) {
        updates.phone = shopifyCustomer.phone
      }
      // Backfill company/organization from Shopify default address
      const shopifyCompany = shopifyCustomer.default_address?.company
      if (shopifyCompany) {
        updates.organization_name = shopifyCompany
      }

      const { error } = await supabase
        .from('customers')
        .update(updates)
        .eq('id', customer.id)

      if (!error) {
        linked++
      } else {
        log.error('Failed to link customer', { customerId: customer.id, error })
      }
    }

    log.info('Bulk link complete', { linked, total: unlinked.length })

    return NextResponse.json({
      success: true,
      linked,
      total: unlinked.length,
      shopifyCustomersFound: shopifyCustomers.length,
    })
  } catch (error: any) {
    log.error('Bulk link error', { error })
    return serverError('An error occurred during bulk linking')
  }
}
