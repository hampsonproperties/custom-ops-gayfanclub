/**
 * List All New Inquiry Items
 *
 * Shows all new_inquiry items to identify junk
 */

import { config } from 'dotenv'
import { resolve } from 'path'
import { createClient } from '@supabase/supabase-js'

config({ path: resolve(process.cwd(), '.env.local') })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

async function listInquiries() {
  const { data: inquiries } = await supabase
    .from('work_items')
    .select('*')
    .eq('status', 'new_inquiry')
    .is('closed_at', null)
    .order('created_at', { ascending: false })

  console.log(`📋 ALL NEW INQUIRY ITEMS (${inquiries?.length || 0}):\n`)

  const junkPatterns = [
    'openai',
    'test',
    'demo',
    'example',
    'spam',
    '@qq.com',
    '@163.com',
    'dammy',
    'dummy',
  ]

  const potentialJunk = []
  const legitimate = []

  for (const item of inquiries || []) {
    const name = (item.customer_name || '').toLowerCase()
    const email = (item.customer_email || '').toLowerCase()
    const daysSince = Math.floor((Date.now() - new Date(item.created_at).getTime()) / (1000 * 60 * 60 * 24))

    const isJunk = junkPatterns.some(pattern =>
      name.includes(pattern) || email.includes(pattern)
    )

    const entry = {
      ...item,
      daysSince,
      display: `${item.customer_name || 'Unknown'} (${item.customer_email || 'no email'}) - ${daysSince}d ago`
    }

    if (isJunk) {
      potentialJunk.push(entry)
    } else {
      legitimate.push(entry)
    }
  }

  if (potentialJunk.length > 0) {
    console.log(`🚨 POTENTIAL JUNK (${potentialJunk.length}):\n`)
    potentialJunk.forEach(item => {
      console.log(`  - ${item.display}`)
      console.log(`    ID: ${item.id}`)
      console.log(`    Source: ${item.source}`)
    })
  }

  console.log(`\n✅ LEGITIMATE (${legitimate.length}):\n`)
  legitimate.forEach(item => {
    console.log(`  - ${item.display}`)
    if (item.daysSince > 7) {
      console.log(`    ⚠️  OLD - consider following up or closing`)
    }
  })

  if (potentialJunk.length > 0) {
    console.log(`\n📋 JUNK IDs TO CLOSE:`)
    console.log(JSON.stringify(potentialJunk.map(i => i.id), null, 2))
  }
}

listInquiries()
