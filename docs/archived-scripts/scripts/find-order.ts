import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'
import { resolve } from 'path'

config({ path: resolve(process.cwd(), '.env.local') })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

async function findOrder(searchTerm: string) {
  const supabase = createClient(supabaseUrl, supabaseServiceKey)
  
  console.log(`\n🔍 Searching for order: ${searchTerm}...\n`)
  
  const { data: workItems } = await supabase
    .from('work_items')
    .select('*')
    .or(`shopify_order_number.eq.${searchTerm},design_fee_order_number.eq.${searchTerm},shopify_order_id.eq.${searchTerm},design_fee_order_id.eq.${searchTerm}`)
  
  if (!workItems || workItems.length === 0) {
    console.log('❌ No work items found')
    
    // Check webhooks
    const { data: webhooks } = await supabase
      .from('webhook_events')
      .select('*')
      .ilike('payload->>name', `%${searchTerm}%`)
      .limit(5)
    
    if (webhooks && webhooks.length > 0) {
      console.log(`\n📦 Found ${webhooks.length} webhook(s) with this order number:`)
      webhooks.forEach(w => {
        const order = w.payload
        console.log(`   ID: ${w.external_event_id}`)
        console.log(`   Name: ${order.name}`)
        console.log(`   Created: ${w.received_at}`)
      })
    }
  } else {
    console.log(`✅ Found ${workItems.length} work item(s):`)
    workItems.forEach(wi => {
      console.log(`\n   ID: ${wi.id}`)
      console.log(`   Type: ${wi.type}`)
      console.log(`   Shopify #: ${wi.shopify_order_number || 'N/A'}`)
      console.log(`   Design Fee #: ${wi.design_fee_order_number || 'N/A'}`)
    })
  }
}

findOrder(process.argv[2] || '6582').catch(console.error)
