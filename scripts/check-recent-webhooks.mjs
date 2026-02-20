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

console.log('Checking recent webhook activity...\n')

const { data: webhooks, error } = await supabase
  .from('webhook_events')
  .select('*')
  .eq('provider', 'shopify')
  .order('created_at', { ascending: false })
  .limit(10)

if (error) {
  console.error('Error:', error)
  process.exit(1)
}

if (!webhooks || webhooks.length === 0) {
  console.log('✗ NO WEBHOOKS FOUND IN DATABASE')
  console.log('  This means webhooks are NOT configured in Shopify or have never been received.')
} else {
  console.log(`✓ Found ${webhooks.length} recent webhook events:\n`)

  webhooks.forEach((w, i) => {
    console.log(`${i + 1}. Event: ${w.event_type}`)
    console.log(`   Order: ${w.payload?.name || 'unknown'}`)
    console.log(`   Status: ${w.processing_status}`)
    console.log(`   Created: ${w.created_at}`)
    if (w.processing_error) {
      console.log(`   Error: ${w.processing_error}`)
    }
    console.log()
  })

  // Check for orders/create and orders/updated webhooks
  const createEvents = webhooks.filter(w => w.event_type === 'orders/create')
  const updateEvents = webhooks.filter(w => w.event_type === 'orders/updated')

  console.log(`\nSummary:`)
  console.log(`  - orders/create: ${createEvents.length}`)
  console.log(`  - orders/updated: ${updateEvents.length}`)
}

process.exit(0)
