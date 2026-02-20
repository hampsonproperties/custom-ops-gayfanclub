/**
 * Script to inspect a Shopify order's properties to debug order type detection
 *
 * Usage: npx tsx scripts/inspect-shopify-order.ts <order-number>
 */

import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'
import { resolve } from 'path'
import { detectOrderType } from '../lib/shopify/detect-order-type'

// Load environment variables from .env.local
config({ path: resolve(process.cwd(), '.env.local') })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

async function inspectOrder(orderNumber: string) {
  const supabase = createClient(supabaseUrl, supabaseServiceKey)

  // Get Shopify credentials
  const { data: credentials } = await supabase
    .from('integration_accounts')
    .select('*')
    .eq('provider', 'shopify')
    .single()

  if (!credentials) {
    console.error('❌ No Shopify credentials found')
    process.exit(1)
  }

  const shopifyDomain = credentials.credentials.shop
  const accessToken = credentials.credentials.access_token

  console.log(`\n🔍 Fetching order ${orderNumber} from Shopify...`)

  // Search for the order by name
  const searchResponse = await fetch(
    `https://${shopifyDomain}/admin/api/2024-01/orders.json?name=${orderNumber}&status=any`,
    {
      headers: {
        'X-Shopify-Access-Token': accessToken,
        'Content-Type': 'application/json',
      },
    }
  )

  if (!searchResponse.ok) {
    console.error('❌ Shopify API error:', searchResponse.statusText)
    process.exit(1)
  }

  const searchData = await searchResponse.json()
  const order = searchData.orders?.[0]

  if (!order) {
    console.error('❌ Order not found')
    process.exit(1)
  }

  console.log(`\n📦 Order Details:`)
  console.log(`   ID: ${order.id}`)
  console.log(`   Name: ${order.name}`)
  console.log(`   Customer: ${order.customer?.first_name} ${order.customer?.last_name} (${order.customer?.email})`)
  console.log(`   Financial Status: ${order.financial_status}`)
  console.log(`   Tags: ${order.tags || '(none)'}`)

  console.log(`\n📋 Line Items:`)
  for (const item of order.line_items || []) {
    console.log(`\n   Item: ${item.title}`)
    console.log(`   Quantity: ${item.quantity}`)
    console.log(`   SKU: ${item.sku || '(none)'}`)

    if (item.properties && Array.isArray(item.properties)) {
      console.log(`   Properties (${item.properties.length}):`)
      for (const prop of item.properties) {
        const propName = prop.name || ''
        const propValue = prop.value || ''
        const isUrl = propValue.includes('http')
        const displayValue = isUrl ? `[URL: ${propValue.substring(0, 50)}...]` : propValue
        console.log(`      - ${propName}: ${displayValue}`)
      }
    } else {
      console.log(`   Properties: (none)`)
    }
  }

  // Run detection
  const detectedType = detectOrderType(order)
  console.log(`\n🔍 Detection Result:`)
  console.log(`   Detected Type: ${detectedType || 'NOT A CUSTOM ORDER'}`)

  // Expected behavior
  console.log(`\n💡 Expected Behavior:`)
  const hasCustomifyProps = order.line_items?.some((item: any) =>
    item.properties?.some((prop: any) =>
      prop.name?.toLowerCase().includes('customify')
    )
  )
  const hasCustomifyInTitle = order.line_items?.some((item: any) =>
    item.title?.toLowerCase().includes('customify')
  )
  const hasCustomifyInTags = order.tags?.toLowerCase().includes('customify')

  console.log(`   Has 'customify' in properties: ${hasCustomifyProps}`)
  console.log(`   Has 'customify' in title: ${hasCustomifyInTitle}`)
  console.log(`   Has 'customify' in tags: ${hasCustomifyInTags}`)

  if (hasCustomifyProps || hasCustomifyInTitle || hasCustomifyInTags) {
    console.log(`   ✓ Should be detected as: customify_order`)
  }

  // Check for competing detections
  const hasDesignService = order.line_items?.some((item: any) => {
    const title = item.title?.toLowerCase() || ''
    return title.includes('professional custom fan design service') ||
           title.includes('custom fan design service') ||
           title.includes('design service & credit')
  })

  const hasPersonalization = order.line_items?.some((item: any) =>
    item.properties?.some((prop: any) =>
      prop.name?.toLowerCase().includes('personalization')
    )
  )

  const hasBulkInTitle = order.line_items?.some((item: any) => {
    const title = item.title?.toLowerCase() || ''
    return title.includes('bulk order') || title.includes('bulk fan') || title.includes('custom bulk')
  })

  console.log(`\n⚠️  Competing Detection Rules:`)
  console.log(`   Has design service product: ${hasDesignService}`)
  console.log(`   Has 'personalization' properties: ${hasPersonalization}`)
  console.log(`   Has 'bulk' in title: ${hasBulkInTitle}`)

  if (hasPersonalization || hasBulkInTitle) {
    console.log(`   ⚠️  This is why it's being detected as 'custom_bulk_order' instead!`)
  }
}

// Get order number from command line args
const orderNumber = process.argv[2]

if (!orderNumber) {
  console.error('Usage: npx tsx scripts/inspect-shopify-order.ts <order-number>')
  console.error('Example: npx tsx scripts/inspect-shopify-order.ts #6582')
  process.exit(1)
}

inspectOrder(orderNumber).catch(console.error)
