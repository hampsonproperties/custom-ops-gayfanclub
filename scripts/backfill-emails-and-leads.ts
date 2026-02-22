/**
 * Backfill Script: Refetch Email Names & Auto-Create Leads
 *
 * This script:
 * 1. Refetches real sender names from Microsoft Graph API
 * 2. Auto-creates leads for primary emails without work items
 *
 * Run: npx tsx scripts/backfill-emails-and-leads.ts
 */

import { config } from 'dotenv'
import { resolve } from 'path'
import { createClient } from '@supabase/supabase-js'

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
  from_email: string
  from_name: string | null
  provider_message_id: string | null
  category: string
  work_item_id: string | null
  subject: string | null
  received_at: string
}

// System/vendor domains that should NOT auto-create leads
const SYSTEM_DOMAINS = [
  // Payment processors
  'paypal.com',
  'stripe.com',
  'square.com',
  'squareup.com',
  'apple.com',
  'insideapple.apple.com',

  // E-commerce platforms
  'shopify.com',
  'orders.shopify.com',
  'etsy.com',

  // Business software
  'quickbooks.com',
  'xero.com',
  'asana.com',
  'trello.com',
  'slack.com',
  'monday.com',

  // Communications
  'ringcentral.com',
  'zoom.us',
  'calendly.com',

  // Adobe/Documents
  'adobe.com',
  'acrobat.com',
  'docusign.com',
  'dropbox.com',

  // Dev tools
  'github.com',
  'vercel.com',
  'supabase.com',
  'heroku.com',

  // Email/Marketing
  'mailchimp.com',
  'constantcontact.com',
  'sendgrid.net',
  'hubspot.com',
]

// Email patterns that indicate system/automated emails
const SYSTEM_EMAIL_PATTERNS = [
  /notifications\./i,
  /noreply@/i,
  /no-reply@/i,
  /donotreply@/i,
  /do-not-reply@/i,
  /@marketing\./i,
  /@newsletter\./i,
  /automated@/i,
  /bounce@/i,
  /mailer-daemon@/i,
]

/**
 * Check if an email should auto-create a lead
 * Returns false for system/vendor emails even if categorized as "primary"
 */
function shouldAutoCreateLead(fromEmail: string): boolean {
  const emailLower = fromEmail.toLowerCase()

  // Block system domains (PayPal, Stripe, Shopify, etc.)
  const isSystemDomain = SYSTEM_DOMAINS.some(domain =>
    emailLower.includes(domain.toLowerCase())
  )

  if (isSystemDomain) {
    console.log(`⏭️  Skipping system domain: ${fromEmail}`)
    return false
  }

  // Block system email patterns (noreply@, notifications., etc.)
  const isSystemPattern = SYSTEM_EMAIL_PATTERNS.some(pattern =>
    pattern.test(fromEmail)
  )

  if (isSystemPattern) {
    console.log(`⏭️  Skipping system pattern: ${fromEmail}`)
    return false
  }

  // Passed all checks - safe to create lead
  return true
}

async function getMicrosoftGraphToken(): Promise<string> {
  const tenantId = process.env.MICROSOFT_TENANT_ID
  const clientId = process.env.MICROSOFT_CLIENT_ID
  const clientSecret = process.env.MICROSOFT_CLIENT_SECRET

  if (!tenantId || !clientId || !clientSecret) {
    throw new Error('Missing Microsoft Graph credentials')
  }

  const tokenUrl = `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`

  const params = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    scope: 'https://graph.microsoft.com/.default',
    grant_type: 'client_credentials',
  })

  const response = await fetch(tokenUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: params.toString(),
  })

  if (!response.ok) {
    throw new Error(`Failed to get Microsoft Graph token: ${response.statusText}`)
  }

  const data = await response.json()
  return data.access_token
}

async function refetchEmailNames(accessToken: string) {
  console.log('\n=== STEP 1: Refetching Real Names from Microsoft Graph ===\n')

  // Get emails without names that have provider_message_id
  const { data: emails, error } = await supabase
    .from('communications')
    .select('id, from_email, from_name, provider_message_id, subject')
    .is('from_name', null)
    .not('provider_message_id', 'is', null)
    .order('received_at', { ascending: false })
    .limit(500) // Process in batches

  if (error) {
    console.error('Error fetching emails:', error)
    return
  }

  if (!emails || emails.length === 0) {
    console.log('✅ All emails already have names!')
    return
  }

  console.log(`Found ${emails.length} emails without names. Fetching from Microsoft Graph...`)

  let updated = 0
  let skipped = 0

  for (const email of emails) {
    try {
      // Fetch message from Microsoft Graph
      const messageUrl = `https://graph.microsoft.com/v1.0/users/sales@thegayfanclub.com/messages/${email.provider_message_id}`

      const response = await fetch(messageUrl, {
        headers: { Authorization: `Bearer ${accessToken}` },
      })

      if (!response.ok) {
        console.log(`⚠️  Skipping ${email.from_email} - API error: ${response.status}`)
        skipped++
        continue
      }

      const message = await response.json()
      const senderName = message.from?.emailAddress?.name

      if (senderName && senderName !== email.from_email) {
        // Update the email with real name
        await supabase
          .from('communications')
          .update({ from_name: senderName })
          .eq('id', email.id)

        console.log(`✅ Updated: ${senderName} (${email.from_email})`)
        updated++
      } else {
        // No name available, use parsed version
        const parsedName = email.from_email
          .split('@')[0]
          .replace(/[._-]/g, ' ')
          .split(' ')
          .map((word: string) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
          .join(' ')

        await supabase
          .from('communications')
          .update({ from_name: parsedName })
          .eq('id', email.id)

        console.log(`📝 Parsed: ${parsedName} (${email.from_email})`)
        updated++
      }

      // Rate limiting - wait 100ms between requests
      await new Promise(resolve => setTimeout(resolve, 100))

    } catch (err) {
      console.error(`Error processing ${email.from_email}:`, err)
      skipped++
    }
  }

  console.log(`\n✅ Step 1 Complete: Updated ${updated} emails, skipped ${skipped}`)
}

async function autoCreateLeads() {
  console.log('\n=== STEP 2: Auto-Creating Leads for Primary Emails ===\n')

  // Get primary emails without work items
  const { data: emails, error } = await supabase
    .from('communications')
    .select('id, from_email, from_name, subject, received_at, category')
    .eq('category', 'primary')
    .eq('direction', 'inbound')
    .is('work_item_id', null)
    .order('received_at', { ascending: false })
    .limit(200)

  if (error) {
    console.error('Error fetching primary emails:', error)
    return
  }

  if (!emails || emails.length === 0) {
    console.log('✅ All primary emails already have leads!')
    return
  }

  console.log(`Found ${emails.length} primary emails without leads. Creating work items...\n`)

  let created = 0
  let skipped = 0

  // Group emails by sender to avoid duplicate leads
  const emailsBySender = new Map<string, typeof emails>()

  for (const email of emails) {
    if (!emailsBySender.has(email.from_email)) {
      emailsBySender.set(email.from_email, [])
    }
    emailsBySender.get(email.from_email)!.push(email)
  }

  for (const [senderEmail, senderEmails] of emailsBySender.entries()) {
    const latestEmail = senderEmails[0] // Most recent email

    try {
      // Skip system/vendor emails (PayPal, Stripe, noreply@, etc.)
      if (!shouldAutoCreateLead(senderEmail)) {
        skipped++
        continue
      }

      // Check if this sender already has a work item (even if not linked)
      const { data: existingWorkItem } = await supabase
        .from('work_items')
        .select('id')
        .eq('customer_email', senderEmail)
        .maybeSingle()

      if (existingWorkItem) {
        // Link all emails to existing work item
        await supabase
          .from('communications')
          .update({ work_item_id: existingWorkItem.id, triage_status: 'attached' })
          .in('id', senderEmails.map(e => e.id))

        console.log(`🔗 Linked ${senderEmails.length} emails to existing lead: ${latestEmail.from_name || senderEmail}`)
        skipped++
        continue
      }

      // Create new work item
      const { data: newWorkItem, error: workItemError } = await supabase
        .from('work_items')
        .insert({
          type: 'assisted_project',
          source: 'email',
          status: 'new_inquiry',
          customer_name: latestEmail.from_name || senderEmail,
          customer_email: senderEmail,
          title: latestEmail.subject || `Inquiry from ${latestEmail.from_name || senderEmail}`,
          last_contact_at: latestEmail.received_at,
          reason_included: {
            detected_via: 'backfill_script',
            backfilled_at: new Date().toISOString(),
          },
        })
        .select('id')
        .single()

      if (workItemError) {
        console.error(`❌ Error creating lead for ${senderEmail}:`, workItemError)
        skipped++
        continue
      }

      // Link all emails from this sender to the new work item
      await supabase
        .from('communications')
        .update({ work_item_id: newWorkItem.id, triage_status: 'created_lead' })
        .in('id', senderEmails.map(e => e.id))

      // Calculate follow-up date
      try {
        const { data: nextFollowUp } = await supabase
          .rpc('calculate_next_follow_up', { work_item_id: newWorkItem.id })

        if (nextFollowUp !== undefined) {
          await supabase
            .from('work_items')
            .update({ next_follow_up_at: nextFollowUp })
            .eq('id', newWorkItem.id)
        }
      } catch (followUpError) {
        console.log(`⚠️  Could not calculate follow-up for ${senderEmail}`)
      }

      console.log(`✅ Created lead: ${latestEmail.from_name || senderEmail} (${senderEmails.length} emails linked)`)
      created++

    } catch (err) {
      console.error(`Error processing ${senderEmail}:`, err)
      skipped++
    }
  }

  console.log(`\n✅ Step 2 Complete: Created ${created} leads, skipped ${skipped}`)
}

async function main() {
  console.log('🚀 Starting Email & Lead Backfill...')
  console.log('This will:')
  console.log('  1. Refetch real names from Microsoft Graph')
  console.log('  2. Auto-create leads for primary emails\n')

  try {
    // Get Microsoft Graph access token
    const accessToken = await getMicrosoftGraphToken()

    // Step 1: Refetch email names
    await refetchEmailNames(accessToken)

    // Step 2: Auto-create leads
    await autoCreateLeads()

    console.log('\n🎉 BACKFILL COMPLETE!')
    console.log('Refresh your inbox to see the updates.')

  } catch (error) {
    console.error('\n❌ Error during backfill:', error)
    process.exit(1)
  }
}

main()
