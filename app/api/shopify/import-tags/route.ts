/**
 * Bulk Import Shopify Customer Tags
 *
 * POST /api/shopify/import-tags
 *
 * Fetches all Shopify customers with tags, matches them to our customers,
 * and runs syncCustomerTags for each of their work items.
 * Reusable for initial import or re-sync.
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient as createAuthClient } from '@/lib/supabase/server'
import { createClient } from '@supabase/supabase-js'
import { syncCustomerTags } from '@/lib/shopify/sync-customer-tags'
import { logger } from '@/lib/logger'
import { unauthorized, serverError } from '@/lib/api/errors'
import { SHOPIFY_API_VERSION } from '@/lib/config'

const log = logger('shopify-import-tags')

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

export async function POST(request: NextRequest) {
  try {
    // Auth check
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

    // 1. Fetch all Shopify customers (paginated)
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

    // 2. Filter to customers with tags
    const customersWithTags = shopifyCustomers.filter(c => c.tags && c.tags.trim().length > 0)
    log.info('Customers with tags', { count: customersWithTags.length })

    // 3. Build shopify_id → tags map
    const shopifyIdToTags = new Map<string, string[]>()
    for (const sc of customersWithTags) {
      const tags = sc.tags.split(',').map((t: string) => t.trim()).filter(Boolean)
      if (tags.length > 0) {
        shopifyIdToTags.set(sc.id.toString(), tags)
      }
    }

    // 4. Fetch our customers that have shopify_customer_id
    const shopifyIds = [...shopifyIdToTags.keys()]
    let matchedCustomers: any[] = []

    // Batch fetch in chunks of 100 to avoid query limits
    for (let i = 0; i < shopifyIds.length; i += 100) {
      const chunk = shopifyIds.slice(i, i + 100)
      const { data } = await supabase
        .from('customers')
        .select('id, shopify_customer_id')
        .in('shopify_customer_id', chunk)

      if (data) matchedCustomers.push(...data)
    }

    log.info('Matched customers in DB', { count: matchedCustomers.length })

    // 5. For each matched customer, find their work items and sync tags
    let totalLinked = 0
    let totalCreated = 0
    let totalWorkItems = 0
    const errors: string[] = []

    for (const customer of matchedCustomers) {
      const shopifyTags = shopifyIdToTags.get(customer.shopify_customer_id)
      if (!shopifyTags || shopifyTags.length === 0) continue

      // Find work items for this customer
      const { data: workItems } = await supabase
        .from('work_items')
        .select('id')
        .eq('customer_id', customer.id)

      if (!workItems || workItems.length === 0) continue

      for (const wi of workItems) {
        totalWorkItems++
        const result = await syncCustomerTags(supabase, wi.id, shopifyTags)
        totalLinked += result.linked
        totalCreated += result.created
        if (result.errors.length > 0) {
          errors.push(...result.errors.map(e => `Work item ${wi.id}: ${e}`))
        }
      }
    }

    log.info('Bulk tag import complete', {
      shopifyCustomers: shopifyCustomers.length,
      customersWithTags: customersWithTags.length,
      matchedCustomers: matchedCustomers.length,
      workItemsProcessed: totalWorkItems,
      tagsLinked: totalLinked,
      tagsCreated: totalCreated,
      errors: errors.length,
    })

    return NextResponse.json({
      success: true,
      shopifyCustomersFetched: shopifyCustomers.length,
      customersWithTags: customersWithTags.length,
      matchedInDb: matchedCustomers.length,
      workItemsProcessed: totalWorkItems,
      tagsLinked: totalLinked,
      tagsCreated: totalCreated,
      errors: errors.slice(0, 10), // Limit error list
    })
  } catch (error: any) {
    log.error('Bulk tag import error', { error })
    return serverError('An error occurred during tag import')
  }
}
