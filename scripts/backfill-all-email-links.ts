/**
 * Backfill Script: Link All Orphaned Emails to Work Items
 *
 * This script finds all communications without work_item_id and attempts to link them
 * using the enhanced auto-linking logic (thread, order#, email, title matching).
 *
 * Special focus on:
 * - Outbound emails (from company to customers) - checks to_emails
 * - Inbound emails that were imported before auto-linking was enhanced
 *
 * Run: npx tsx scripts/backfill-all-email-links.ts
 */

import { config } from 'dotenv'
import { resolve } from 'path'
import { createClient } from '@supabase/supabase-js'
import { autoLinkEmailToWorkItem } from '@/lib/utils/order-number-extractor'

// Load environment variables from .env.local
config({ path: resolve(process.cwd(), '.env.local') })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing required environment variables')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseServiceKey)

interface EmailRecord {
  id: string
  direction: 'inbound' | 'outbound'
  from_email: string
  to_emails: string[]
  subject: string | null
  body_preview: string | null
  provider_thread_id: string | null
  received_at: string
}

async function backfillEmailLinks() {
  console.log('🚀 Starting Email Link Backfill...\n')

  // Fetch all unlinked emails (excluding archived/junk)
  const { data: unlinkedEmails, error } = await supabase
    .from('communications')
    .select('id, direction, from_email, to_emails, subject, body_preview, provider_thread_id, received_at')
    .is('work_item_id', null)
    .not('triage_status', 'in', '(archived,filtered_junk)')
    .order('received_at', { ascending: false })
    .limit(1000) // Process in batches

  if (error) {
    console.error('❌ Error fetching unlinked emails:', error)
    process.exit(1)
  }

  if (!unlinkedEmails || unlinkedEmails.length === 0) {
    console.log('✅ All emails are already linked!')
    return
  }

  console.log(`Found ${unlinkedEmails.length} unlinked emails\n`)
  console.log('Breakdown:')
  const inbound = unlinkedEmails.filter(e => e.direction === 'inbound').length
  const outbound = unlinkedEmails.filter(e => e.direction === 'outbound').length
  console.log(`  - Inbound: ${inbound}`)
  console.log(`  - Outbound: ${outbound}\n`)

  let linkedCount = 0
  let skippedCount = 0
  const results = {
    linkedByThread: 0,
    linkedByOrderNumber: 0,
    linkedByEmail: 0,
    linkedByTitle: 0,
    notLinked: 0,
  }

  for (const email of unlinkedEmails as EmailRecord[]) {
    try {
      // Construct message object for auto-linking
      const message = {
        id: email.id,
        subject: email.subject,
        body: email.body_preview,
        conversationId: email.provider_thread_id,
        from: {
          emailAddress: {
            address: email.from_email
          }
        },
        toRecipients: email.to_emails.map(e => ({
          emailAddress: { address: e }
        }))
      }

      // Try to auto-link using enhanced logic
      const workItemId = await autoLinkEmailToWorkItem(supabase, message)

      if (workItemId) {
        // Link the email to the work item
        const { error: updateError } = await supabase
          .from('communications')
          .update({
            work_item_id: workItemId,
            triage_status: 'attached'
          })
          .eq('id', email.id)

        if (updateError) {
          console.error(`❌ Error linking email ${email.id}:`, updateError)
          skippedCount++
          continue
        }

        linkedCount++

        // Track which strategy worked (based on console log from autoLinkEmailToWorkItem)
        // This is approximate since we can't directly see the strategy used
        console.log(`✅ Linked: ${email.direction === 'outbound' ? 'TO' : 'FROM'} ${email.direction === 'outbound' ? email.to_emails[0] : email.from_email} → ${workItemId}`)
        console.log(`   Subject: ${email.subject || '(no subject)'}`)

      } else {
        results.notLinked++
        if (process.env.VERBOSE) {
          console.log(`⏭️  No match: ${email.direction} - ${email.subject || '(no subject)'}`)
        }
      }

      // Rate limiting - small delay between requests
      await new Promise(resolve => setTimeout(resolve, 10))

    } catch (err) {
      console.error(`❌ Error processing email ${email.id}:`, err)
      skippedCount++
    }
  }

  console.log('\n' + '='.repeat(60))
  console.log('📊 BACKFILL COMPLETE')
  console.log('='.repeat(60))
  console.log(`✅ Successfully linked: ${linkedCount}`)
  console.log(`⏭️  Could not link: ${results.notLinked}`)
  console.log(`❌ Errors: ${skippedCount}`)
  console.log(`📧 Total processed: ${unlinkedEmails.length}`)
  console.log('='.repeat(60))

  // Show some statistics about the unlinked ones
  if (results.notLinked > 0) {
    console.log('\n💡 TIP: Emails that could not be auto-linked may need manual linking.')
    console.log('   Common reasons:')
    console.log('   - No matching work item exists yet')
    console.log('   - Email is from/to a different customer email not in the system')
    console.log('   - Lead was closed or updated more than 60 days ago')
  }
}

async function main() {
  try {
    await backfillEmailLinks()
  } catch (error) {
    console.error('\n❌ Fatal error during backfill:', error)
    process.exit(1)
  }
}

main()
