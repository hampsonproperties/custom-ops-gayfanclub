/**
 * Check Name Quality
 *
 * Find work items where customer_name is just the email address
 */

import { config } from 'dotenv'
import { resolve } from 'path'
import { createClient } from '@supabase/supabase-js'

config({ path: resolve(process.cwd(), '.env.local') })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

const supabase = createClient(supabaseUrl, supabaseServiceKey)

async function checkNameQuality() {
  console.log('🔍 Checking name quality...\n')

  // Get all open work items
  const { data: items } = await supabase
    .from('work_items')
    .select('id, customer_name, customer_email')
    .is('closed_at', null)
    .eq('status', 'new_inquiry')
    .limit(50)

  console.log('Sample of new_inquiry items:\n')

  let emailAsName = 0
  let realName = 0

  for (const item of items || []) {
    const name = item.customer_name || ''
    const email = item.customer_email || ''

    // Check if name is the same as email
    if (name === email || name.includes('@')) {
      console.log(`📧 ${item.customer_name} (email as name)`)
      emailAsName++
    } else {
      console.log(`✅ ${item.customer_name}`)
      realName++
    }
  }

  console.log(`\n📊 SUMMARY:`)
  console.log(`Real names: ${realName}`)
  console.log(`Email as name: ${emailAsName}`)

  // Check if we have from_name in communications for these
  console.log(`\n🔍 Checking if communications have real names...`)

  const emailAsNameItems = (items || []).filter(i =>
    i.customer_name === i.customer_email || (i.customer_name?.includes('@'))
  )

  let canBeFixed = 0

  for (const item of emailAsNameItems.slice(0, 10)) {
    const { data: comm } = await supabase
      .from('communications')
      .select('from_name, from_email')
      .eq('from_email', item.customer_email)
      .not('from_name', 'is', null)
      .neq('from_name', item.customer_email)
      .limit(1)
      .maybeSingle()

    if (comm && comm.from_name) {
      console.log(`  ${item.customer_email} → "${comm.from_name}" ✅ CAN FIX`)
      canBeFixed++
    } else {
      console.log(`  ${item.customer_email} → No name available ❌`)
    }
  }

  console.log(`\n💡 ${canBeFixed}/${emailAsNameItems.length} items can have names extracted from emails`)
}

checkNameQuality()
