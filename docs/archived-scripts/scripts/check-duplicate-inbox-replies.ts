/**
 * Check for duplicate emails in inbox replies
 */

import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'
import { resolve } from 'path'

config({ path: resolve(process.cwd(), '.env.local') })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

async function checkDuplicates() {
  const supabase = createClient(supabaseUrl, supabaseServiceKey)

  console.log(`\n🔍 Checking for duplicate emails in Inbox Replies...\n`)

  // Get inbox replies (same query as the page)
  const { data: replies, error } = await supabase
    .from('communications')
    .select('*')
    .eq('direction', 'inbound')
    .is('actioned_at', null)
    .not('work_item_id', 'is', null)
    .order('received_at', { ascending: false })

  if (error) {
    console.error('❌ Error:', error)
    process.exit(1)
  }

  console.log(`📊 Total inbox replies: ${replies?.length || 0}`)

  // Group by internet_message_id
  const messageIdGroups = new Map<string, any[]>()
  const noMessageId: any[] = []

  for (const reply of replies || []) {
    if (!reply.internet_message_id) {
      noMessageId.push(reply)
    } else {
      if (!messageIdGroups.has(reply.internet_message_id)) {
        messageIdGroups.set(reply.internet_message_id, [])
      }
      messageIdGroups.get(reply.internet_message_id)!.push(reply)
    }
  }

  // Find duplicates
  const duplicates = Array.from(messageIdGroups.entries()).filter(([_, emails]) => emails.length > 1)

  console.log(`\n📧 Emails without internet_message_id: ${noMessageId.length}`)
  if (noMessageId.length > 0) {
    console.log('   ⚠️  These emails are vulnerable to duplication!')
    noMessageId.slice(0, 5).forEach(email => {
      console.log(`      - ${email.subject} from ${email.from_email}`)
    })
  }

  console.log(`\n🔁 Duplicate groups found: ${duplicates.length}`)

  if (duplicates.length > 0) {
    console.log('\n❌ DUPLICATES DETECTED:\n')

    for (const [messageId, emails] of duplicates.slice(0, 10)) {
      console.log(`Message ID: ${messageId}`)
      console.log(`   Appears: ${emails.length} times`)
      console.log(`   Subject: ${emails[0].subject}`)
      console.log(`   From: ${emails[0].from_email}`)
      console.log(`   IDs:`)
      emails.forEach(email => {
        console.log(`      - ${email.id} (received: ${email.received_at})`)
      })
      console.log()
    }

    // Suggest fix
    console.log(`\n💡 FIX: Delete duplicate communications, keeping only the oldest:`)
    for (const [messageId, emails] of duplicates) {
      const sorted = emails.sort((a, b) =>
        new Date(a.received_at).getTime() - new Date(b.received_at).getTime()
      )
      const toDelete = sorted.slice(1) // Keep first, delete rest

      if (toDelete.length > 0) {
        console.log(`\nDELETE FROM communications WHERE id IN (`)
        toDelete.forEach((email, idx) => {
          console.log(`  '${email.id}'${idx < toDelete.length - 1 ? ',' : ''}`)
        })
        console.log(`);`)
      }
    }
  } else {
    console.log('✅ No duplicates found!')
  }

  // Check for same subject/sender duplicates (might have different message IDs if re-sent)
  const subjectSenderGroups = new Map<string, any[]>()

  for (const reply of replies || []) {
    const key = `${reply.from_email}|||${reply.subject}`
    if (!subjectSenderGroups.has(key)) {
      subjectSenderGroups.set(key, [])
    }
    subjectSenderGroups.get(key)!.push(reply)
  }

  const possibleDuplicates = Array.from(subjectSenderGroups.entries())
    .filter(([_, emails]) => emails.length > 1)

  if (possibleDuplicates.length > 0) {
    console.log(`\n⚠️  Possible duplicates (same subject/sender): ${possibleDuplicates.length}`)
    for (const [key, emails] of possibleDuplicates.slice(0, 5)) {
      const [sender, subject] = key.split('|||')
      console.log(`\n   "${subject}"`)
      console.log(`   From: ${sender}`)
      console.log(`   Appears: ${emails.length} times with different message IDs`)

      // Check if they have different message IDs
      const uniqueMessageIds = new Set(emails.map(e => e.internet_message_id).filter(Boolean))
      if (uniqueMessageIds.size > 1) {
        console.log(`   ⚠️  Different message IDs - likely re-sent emails or import bug`)
      }
    }
  }
}

checkDuplicates().catch(console.error)
