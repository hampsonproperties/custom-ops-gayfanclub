import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

dotenv.config({ path: join(__dirname, '..', '.env.local') })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

console.log('Fetching order #6568 from Shopify...\n')

// Get Shopify credentials
const { data: credentials, error: credError } = await supabase
  .from('shopify_credentials')
  .select('shop, access_token')
  .eq('shop', process.env.SHOPIFY_STORE_DOMAIN)
  .single()

if (credError || !credentials) {
  console.error('✗ Failed to get Shopify credentials:', credError)
  console.log('\nYou need to connect your Shopify store first.')
  console.log('Visit: http://localhost:3000/api/shopify/install')
  process.exit(1)
}

// Search for order by name
const shopifyUrl = `https://${credentials.shop}/admin/api/2024-01/orders.json?name=6568&limit=1`

try {
  const response = await fetch(shopifyUrl, {
    headers: {
      'X-Shopify-Access-Token': credentials.access_token,
      'Content-Type': 'application/json',
    },
  })

  if (!response.ok) {
    console.error(`✗ Shopify API error: ${response.status} ${response.statusText}`)
    process.exit(1)
  }

  const data = await response.json()

  if (!data.orders || data.orders.length === 0) {
    console.log('✗ Order #6568 not found in Shopify')
    console.log('\nPossible reasons:')
    console.log('  1. Order number is incorrect')
    console.log('  2. Order was deleted')
    console.log('  3. Order is in a different Shopify store')
  } else {
    const order = data.orders[0]
    console.log('✓ Order found in Shopify!\n')
    console.log(`Order Details:`)
    console.log(`  Name: ${order.name}`)
    console.log(`  ID: ${order.id}`)
    console.log(`  Created: ${order.created_at}`)
    console.log(`  Customer: ${order.customer?.first_name} ${order.customer?.last_name} (${order.customer?.email})`)
    console.log(`  Financial Status: ${order.financial_status}`)
    console.log(`  Fulfillment Status: ${order.fulfillment_status || 'none'}`)
    console.log(`  Tags: ${order.tags || 'none'}`)
    console.log(`\nLine Items:`)

    order.line_items.forEach((item, i) => {
      console.log(`  ${i + 1}. ${item.title}`)
      console.log(`     Quantity: ${item.quantity}`)
      console.log(`     Price: $${item.price}`)

      if (item.properties && item.properties.length > 0) {
        console.log(`     Properties:`)
        item.properties.forEach(prop => {
          const value = prop.value?.substring(0, 50) + (prop.value?.length > 50 ? '...' : '')
          console.log(`       - ${prop.name}: ${value}`)
        })
      }
    })

    // Check if it would be detected as custom
    const hasCustomifyProps = order.line_items.some(item =>
      item.properties?.some(prop => prop.name?.toLowerCase().includes('customify'))
    )
    const hasCustomTags = order.tags?.toLowerCase().includes('custom') || false
    const hasDesignService = order.line_items.some(item =>
      item.title?.toLowerCase().includes('custom design service')
    )
    const hasBulk = order.line_items.some(item =>
      item.title?.toLowerCase().includes('bulk')
    )

    console.log(`\nWould be detected as custom order?`)
    console.log(`  - Has Customify properties: ${hasCustomifyProps ? '✓' : '✗'}`)
    console.log(`  - Has custom tags: ${hasCustomTags ? '✓' : '✗'}`)
    console.log(`  - Has "Custom Design Service": ${hasDesignService ? '✓' : '✗'}`)
    console.log(`  - Has "Bulk" in title: ${hasBulk ? '✓' : '✗'}`)

    if (hasCustomifyProps || hasCustomTags || hasDesignService || hasBulk) {
      console.log(`\n✓ This order SHOULD be imported as a custom order`)
    } else {
      console.log(`\n✗ This order would NOT be detected as a custom order`)
    }
  }
} catch (error) {
  console.error('Error fetching from Shopify:', error.message)
}

process.exit(0)
