// Run with: export $(grep -v '^#' .env.local | xargs) && node scripts/check-order-6490.js
const { createClient } = require('@supabase/supabase-js')

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

const supabase = createClient(supabaseUrl, supabaseServiceKey)

async function getShopifyCredentials() {
  const { data } = await supabase
    .from('integration_accounts')
    .select('settings')
    .eq('provider', 'shopify')
    .limit(1)
    .maybeSingle()

  return {
    shop: data.settings.shop,
    accessToken: data.settings.access_token,
  }
}

async function checkOrder() {
  console.log('Fetching order #6490 from Shopify...\n')

  try {
    const { shop, accessToken } = await getShopifyCredentials()

    const response = await fetch(
      `https://${shop}/admin/api/2024-01/orders.json?name=6490`,
      {
        headers: {
          'X-Shopify-Access-Token': accessToken,
          'Content-Type': 'application/json',
        },
      }
    )

    const data = await response.json()
    const order = data.orders[0]

    if (!order) {
      console.log('Order not found')
      return
    }

    console.log('Order #' + order.name)
    console.log('Customer:', order.customer?.first_name, order.customer?.last_name)
    console.log('Email:', order.customer?.email)
    console.log('Tags:', order.tags)
    console.log('Financial Status:', order.financial_status)
    console.log('\nLine Items:')
    console.log('='.repeat(80))

    let customItems = []
    let standardItems = []

    order.line_items.forEach((item, index) => {
      console.log(`\nItem ${index + 1}:`)
      console.log('  Title:', item.title)
      console.log('  Quantity:', item.quantity)
      console.log('  SKU:', item.sku || '(none)')

      // Check if it's a custom item
      const title = item.title.toLowerCase()
      const isCustom = title.includes('custom') || title.includes('bulk')

      if (isCustom) {
        customItems.push(item)
        console.log('  Type: CUSTOM ✓')
      } else {
        standardItems.push(item)
        console.log('  Type: STANDARD')
      }

      if (item.properties && item.properties.length > 0) {
        console.log('  Properties:')
        item.properties.forEach(prop => {
          console.log(`    - ${prop.name}: ${prop.value}`)
        })
      }
    })

    console.log('\n' + '='.repeat(80))
    console.log('\nSummary:')
    console.log(`Custom items: ${customItems.length}`)
    console.log(`Standard items: ${standardItems.length}`)

    if (customItems.length > 0) {
      console.log('\nCustom items to track:')
      customItems.forEach(item => {
        console.log(`  - ${item.title} (qty: ${item.quantity})`)
      })
    }
  } catch (err) {
    console.error('Error:', err.message)
  }
}

checkOrder()
