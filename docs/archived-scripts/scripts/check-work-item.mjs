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

async function checkWorkItem() {
  const workItemId = '53e9c29a-4e7e-453d-a864-b72343cbafee'

  // Get work item details
  const { data: workItem, error: workItemError } = await supabase
    .from('work_items')
    .select('*')
    .eq('id', workItemId)
    .single()

  if (workItemError) {
    console.error('Error fetching work item:', workItemError)
    return
  }

  console.log('\n=== WORK ITEM ===')
  console.log('ID:', workItem.id)
  console.log('Type:', workItem.type)
  console.log('Status:', workItem.status)
  console.log('Customer Email:', workItem.customer_email)
  console.log('Customer Name:', workItem.customer_name)
  console.log('Shopify Order ID:', workItem.shopify_order_id)
  console.log('Shopify Order #:', workItem.shopify_order_number)
  console.log('Financial Status:', workItem.shopify_financial_status)
  console.log('Fulfillment Status:', workItem.shopify_fulfillment_status)
  console.log('Created:', workItem.created_at)
  console.log('Source:', workItem.source)

  // Get associated emails
  const { data: emails, error: emailError } = await supabase
    .from('communications')
    .select('id, from_email, subject, received_at, work_item_id, triage_status')
    .eq('from_email', workItem.customer_email)
    .order('received_at', { ascending: false })

  if (!emailError && emails) {
    console.log('\n=== EMAILS FROM THIS CUSTOMER ===')
    console.log(`Found ${emails.length} emails total`)

    const linked = emails.filter(e => e.work_item_id === workItemId)
    const unlinked = emails.filter(e => !e.work_item_id)
    const linkedOther = emails.filter(e => e.work_item_id && e.work_item_id !== workItemId)

    console.log(`- ${linked.length} linked to THIS work item`)
    console.log(`- ${unlinked.length} unlinked`)
    console.log(`- ${linkedOther.length} linked to OTHER work items`)

    if (unlinked.length > 0) {
      console.log('\nUnlinked emails:')
      unlinked.forEach(email => {
        console.log(`  - ${email.received_at}: ${email.subject}`)
      })
    }
  }

  // Get status events
  const { data: events } = await supabase
    .from('work_item_status_events')
    .select('*')
    .eq('work_item_id', workItemId)
    .order('created_at', { ascending: true })

  if (events && events.length > 0) {
    console.log('\n=== STATUS HISTORY ===')
    events.forEach(event => {
      console.log(`${event.created_at}: ${event.from_status || 'NEW'} → ${event.to_status}`)
      if (event.note) console.log(`  Note: ${event.note}`)
    })
  }
}

checkWorkItem().then(() => process.exit(0)).catch(err => {
  console.error(err)
  process.exit(1)
})
