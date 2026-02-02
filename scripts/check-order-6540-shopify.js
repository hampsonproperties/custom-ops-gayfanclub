// Run with: export $(grep -v '^#' .env.local | xargs) && node scripts/check-order-6540-shopify.js
const { createClient } = require('@supabase/supabase-js')

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing environment variables')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseServiceKey)

async function getShopifyCredentials() {
  const { data, error } = await supabase
    .from('integration_accounts')
    .select('settings')
    .eq('provider', 'shopify')
    .limit(1)
    .maybeSingle()

  if (error) throw error
  if (!data) {
    throw new Error('No Shopify integration found')
  }
  return {
    shop: data.settings.shop,
    accessToken: data.settings.access_token,
  }
}

async function checkOrder() {
  console.log('Fetching order #6540 from Shopify...\n')

  try {
    const { shop, accessToken } = await getShopifyCredentials()

    // Fetch order from Shopify
    const response = await fetch(
      `https://${shop}/admin/api/2024-01/orders.json?name=6540`,
      {
        headers: {
          'X-Shopify-Access-Token': accessToken,
          'Content-Type': 'application/json',
        },
      }
    )

    if (!response.ok) {
      throw new Error(`Shopify API error: ${response.statusText}`)
    }

    const data = await response.json()
    const order = data.orders[0]

    if (!order) {
      console.log('Order not found')
      return
    }

    console.log('Order #' + order.name)
    console.log('Customer:', order.customer?.first_name, order.customer?.last_name)
    console.log('\nLine Items:')
    console.log('=' .repeat(80))

    order.line_items.forEach((item, index) => {
      console.log(`\nItem ${index + 1}:`)
      console.log('  Title:', item.title)
      console.log('  Quantity:', item.quantity)
      console.log('  Price:', item.price)

      if (item.properties && item.properties.length > 0) {
        console.log('  Properties:')
        item.properties.forEach(prop => {
          console.log(`    - ${prop.name}: ${prop.value}`)
        })
      }
    })

    console.log('\n' + '='.repeat(80))
    console.log('\nOrder Tags:', order.tags)
    console.log('Financial Status:', order.financial_status)
    console.log('Fulfillment Status:', order.fulfillment_status)

  } catch (err) {
    console.error('Error:', err.message)
  }
}

checkOrder()
