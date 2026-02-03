import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = 'https://uvdaqjxmstbhfcgjlemm.supabase.co'
const SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InV2ZGFxanhtc3RiaGZjZ2psZW1tIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2OTU1NjYxMiwiZXhwIjoyMDg1MTMyNjEyfQ.aD3n7cnEBfMO4E8iZqEXly8QUlggUu-LNHjxcve19Ds'
const WORK_ITEM_ID = 'faa42e63-7642-4235-a3cd-13f912216bbe'
const CUSTOMER_EMAIL = 'liztillman515@gmail.com'

const supabase = createClient(SUPABASE_URL, SERVICE_KEY)

async function linkEmails() {
  console.log(`🔗 Linking emails from ${CUSTOMER_EMAIL} to work item ${WORK_ITEM_ID}`)

  // Get all unlinked emails from this customer
  const { data: emails, error: fetchError } = await supabase
    .from('communications')
    .select('id, subject, received_at')
    .eq('from_email', CUSTOMER_EMAIL)
    .is('work_item_id', null)
    .order('received_at', { ascending: true })

  if (fetchError) {
    console.error('Error fetching emails:', fetchError)
    return
  }

  if (!emails || emails.length === 0) {
    console.log('✅ No unlinked emails found')
    return
  }

  console.log(`\n📧 Found ${emails.length} unlinked emails:`)
  emails.forEach(email => {
    const date = new Date(email.received_at).toLocaleString()
    console.log(`   - [${date}] ${email.subject}`)
  })

  // Link them all
  const { error: updateError } = await supabase
    .from('communications')
    .update({
      work_item_id: WORK_ITEM_ID,
      triage_status: 'attached'
    })
    .in('id', emails.map(e => e.id))

  if (updateError) {
    console.error('❌ Error linking emails:', updateError)
    return
  }

  console.log(`\n✅ Successfully linked ${emails.length} emails to work item!`)
}

linkEmails()
  .then(() => process.exit(0))
  .catch(err => {
    console.error('Fatal error:', err)
    process.exit(1)
  })
