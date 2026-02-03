import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = 'https://uvdaqjxmstbhfcgjlemm.supabase.co'
const SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InV2ZGFxanhtc3RiaGZjZ2psZW1tIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2OTU1NjYxMiwiZXhwIjoyMDg1MTMyNjEyfQ.aD3n7cnEBfMO4E8iZqEXly8QUlggUu-LNHjxcve19Ds'

const supabase = createClient(SUPABASE_URL, SERVICE_KEY)

async function fixPaymentStatusAndEmails() {
  console.log('🔍 Scanning for work items with incorrect payment status...\n')

  // Find all work items with paid_ready_for_batch status but not actually paid
  const { data: workItems, error: fetchError } = await supabase
    .from('work_items')
    .select('id, status, shopify_financial_status, customer_email, shopify_order_number, created_at, type')
    .eq('status', 'paid_ready_for_batch')
    .neq('shopify_financial_status', 'paid')
    .is('closed_at', null)

  if (fetchError) {
    console.error('Error fetching work items:', fetchError)
    return
  }

  console.log(`Found ${workItems.length} work items with incorrect status\n`)

  if (workItems.length === 0) {
    console.log('✅ No work items need fixing!')
    return
  }

  let fixedCount = 0
  let emailsLinkedCount = 0

  for (const item of workItems) {
    console.log(`\n📦 Work Item: ${item.shopify_order_number || item.id}`)
    console.log(`   Customer: ${item.customer_email}`)
    console.log(`   Current Status: ${item.status}`)
    console.log(`   Financial Status: ${item.shopify_financial_status}`)

    // Determine correct status based on type
    let correctStatus = 'invoice_sent'
    if (item.type === 'assisted_project') {
      correctStatus = 'invoice_sent'
    } else if (item.type === 'customify_order') {
      correctStatus = 'needs_design_review'
    }

    // Update work item status
    const { error: updateError } = await supabase
      .from('work_items')
      .update({ status: correctStatus })
      .eq('id', item.id)

    if (updateError) {
      console.error(`   ❌ Failed to update status:`, updateError.message)
      continue
    }

    // Create status event
    const { error: eventError } = await supabase
      .from('work_item_status_events')
      .insert({
        work_item_id: item.id,
        from_status: 'paid_ready_for_batch',
        to_status: correctStatus,
        changed_by_user_id: null,
        note: `Status corrected: order not yet paid (${item.shopify_financial_status}). Automated fix.`,
      })

    if (eventError) {
      console.error(`   ⚠️  Failed to create status event:`, eventError.message)
    }

    console.log(`   ✅ Updated status: ${item.status} → ${correctStatus}`)
    fixedCount++

    // Link emails from this customer (last 30 days before order)
    if (item.customer_email) {
      const orderDate = new Date(item.created_at)
      const lookbackDate = new Date(orderDate)
      lookbackDate.setDate(lookbackDate.getDate() - 30)

      const { data: recentEmails, error: emailError } = await supabase
        .from('communications')
        .select('id, subject, received_at')
        .eq('from_email', item.customer_email)
        .is('work_item_id', null)
        .gte('received_at', lookbackDate.toISOString())
        .lte('received_at', orderDate.toISOString())
        .order('received_at', { ascending: true })

      if (!emailError && recentEmails && recentEmails.length > 0) {
        const { error: linkError } = await supabase
          .from('communications')
          .update({
            work_item_id: item.id,
            triage_status: 'attached'
          })
          .in('id', recentEmails.map(e => e.id))

        if (linkError) {
          console.error(`   ⚠️  Failed to link emails:`, linkError.message)
        } else {
          console.log(`   📧 Linked ${recentEmails.length} email(s):`)
          recentEmails.forEach(email => {
            const date = new Date(email.received_at).toLocaleDateString()
            console.log(`      - [${date}] ${email.subject}`)
          })
          emailsLinkedCount += recentEmails.length
        }
      } else {
        console.log(`   📧 No emails found to link (within 30 days before order)`)
      }
    }
  }

  console.log('\n' + '='.repeat(60))
  console.log('✨ Fix Summary:')
  console.log(`   - Fixed ${fixedCount} work item(s)`)
  console.log(`   - Linked ${emailsLinkedCount} email(s)`)
  console.log('='.repeat(60))
}

// Run the fix
fixPaymentStatusAndEmails()
  .then(() => process.exit(0))
  .catch(err => {
    console.error('Fatal error:', err)
    process.exit(1)
  })
