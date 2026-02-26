/**
 * Deep Dive: Kandice Hart Emails
 *
 * Checks if there are ANY emails (linked or unlinked) for Kandice Hart
 * and why they aren't showing up
 */

import { config } from 'dotenv'
import { resolve } from 'path'
import { createClient } from '@supabase/supabase-js'

config({ path: resolve(process.cwd(), '.env.local') })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

const supabase = createClient(supabaseUrl, supabaseServiceKey)

async function checkKandiceEmails() {
  const email = 'kandicehart4@gmail.com'

  console.log(`🔍 Searching for ALL emails related to: ${email}\n`)

  // Check FROM this email (inbound)
  const { data: inboundEmails } = await supabase
    .from('communications')
    .select('id, subject, received_at, direction, work_item_id, triage_status')
    .eq('from_email', email)
    .order('received_at', { ascending: false })

  console.log(`📧 Inbound emails (FROM ${email}): ${inboundEmails?.length || 0}`)
  if (inboundEmails && inboundEmails.length > 0) {
    inboundEmails.forEach(e => {
      console.log(`   - ${e.subject || '(no subject)'}`)
      console.log(`     Date: ${new Date(e.received_at).toLocaleDateString()}`)
      console.log(`     Linked: ${e.work_item_id ? 'Yes (ID: ' + e.work_item_id + ')' : 'No'}`)
      console.log()
    })
  }

  // Check TO this email (outbound)
  const { data: outboundEmails } = await supabase
    .from('communications')
    .select('id, subject, received_at, direction, work_item_id, triage_status, to_emails')
    .contains('to_emails', [email])
    .order('received_at', { ascending: false })

  console.log(`\n📤 Outbound emails (TO ${email}): ${outboundEmails?.length || 0}`)
  if (outboundEmails && outboundEmails.length > 0) {
    outboundEmails.forEach(e => {
      console.log(`   - ${e.subject || '(no subject)'}`)
      console.log(`     Date: ${new Date(e.received_at).toLocaleDateString()}`)
      console.log(`     Linked: ${e.work_item_id ? 'Yes (ID: ' + e.work_item_id + ')' : 'No'}`)
      console.log()
    })
  }

  // Get Kandice's work item
  const { data: workItem } = await supabase
    .from('work_items')
    .select('*')
    .eq('customer_email', email)
    .is('closed_at', null)
    .single()

  if (workItem) {
    console.log(`\n📋 Kandice Hart's Work Item:`)
    console.log(`   ID: ${workItem.id}`)
    console.log(`   Status: ${workItem.status}`)
    console.log(`   Source: ${workItem.source}`)
    console.log(`   Created: ${new Date(workItem.created_at).toLocaleDateString()}`)
    console.log(`   Shopify Order: ${workItem.shopify_order_number || 'N/A'}`)

    if (workItem.alternate_emails && workItem.alternate_emails.length > 0) {
      console.log(`   Alternate Emails: ${workItem.alternate_emails.join(', ')}`)
    }
  }

  // Check for similar email addresses (typos, variations)
  const { data: similarEmails } = await supabase
    .from('communications')
    .select('from_email')
    .ilike('from_email', '%kandice%')
    .limit(10)

  if (similarEmails && similarEmails.length > 0) {
    const uniqueEmails = [...new Set(similarEmails.map(e => e.from_email))]
    console.log(`\n🔎 Similar email addresses found:`)
    uniqueEmails.forEach(e => {
      console.log(`   - ${e}`)
    })
  }

  const totalEmails = (inboundEmails?.length || 0) + (outboundEmails?.length || 0)

  console.log(`\n${'='.repeat(60)}`)
  console.log(`SUMMARY: ${totalEmails} total emails found for ${email}`)
  console.log(`${'='.repeat(60)}`)

  if (totalEmails === 0) {
    console.log(`\n💡 Possible reasons:`)
    console.log(`   1. Customer hasn't emailed yet (Shopify order only)`)
    console.log(`   2. Used different email address when ordering vs emailing`)
    console.log(`   3. Emails haven't been imported yet`)
    console.log(`   4. Communication was via phone/text only`)
  }
}

checkKandiceEmails()
