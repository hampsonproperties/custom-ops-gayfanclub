import dotenv from 'dotenv'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

dotenv.config({ path: join(__dirname, '..', '.env.local') })

console.log('Checking webhook configuration...\n')

console.log('Environment Variables:')
console.log(`  SHOPIFY_WEBHOOK_SECRET: ${process.env.SHOPIFY_WEBHOOK_SECRET ? '✓ Set' : '✗ Not set'}`)
console.log(`  SHOPIFY_STORE_DOMAIN: ${process.env.SHOPIFY_STORE_DOMAIN || '✗ Not set'}`)
console.log(`  Production URL: https://custom-ops-gayfanclub.vercel.app`)

console.log('\nExpected webhook URL:')
console.log(`  https://custom-ops-gayfanclub.vercel.app/api/webhooks/shopify`)

console.log('\nTesting webhook endpoint accessibility...')

try {
  const response = await fetch('https://custom-ops-gayfanclub.vercel.app/api/webhooks/shopify', {
    method: 'GET',
  })

  console.log(`  Status: ${response.status}`)
  const text = await response.text()
  console.log(`  Response: ${text.substring(0, 100)}`)

  if (response.status === 405) {
    console.log(`  ✓ Endpoint exists (returns 405 Method Not Allowed for GET, which is expected)`)
  } else if (response.status === 404) {
    console.log(`  ✗ Endpoint not found - webhook URL may be incorrect`)
  } else {
    console.log(`  ⚠️  Unexpected response`)
  }
} catch (error) {
  console.error(`  ✗ Error accessing endpoint:`, error.message)
}

console.log('\nNext steps to debug:')
console.log('  1. Go to Shopify Admin → Settings → Notifications → Webhooks')
console.log('  2. Click on each webhook and check "Recent deliveries"')
console.log('  3. Look for:')
console.log('     - Are webhooks being sent?')
console.log('     - What status codes are being returned?')
console.log('     - Any error messages?')
console.log('  4. Verify the webhook URL matches exactly:')
console.log('     https://custom-ops-gayfanclub.vercel.app/api/webhooks/shopify')

process.exit(0)
