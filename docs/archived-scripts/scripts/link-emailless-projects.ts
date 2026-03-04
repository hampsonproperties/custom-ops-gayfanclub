/**
 * Link Emails to Emailless Custom Projects
 *
 * Specifically targets custom projects with no emails
 * and attempts to find and link their communications
 *
 * Run: npx tsx scripts/link-emailless-projects.ts
 */

import { config } from 'dotenv'
import { resolve } from 'path'
import { createClient } from '@supabase/supabase-js'

config({ path: resolve(process.cwd(), '.env.local') })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing required environment variables')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseServiceKey)

async function linkEmaillessProjects() {
  console.log('🔍 Finding custom projects with no emails...\n')

  // Get all assisted_project items
  const { data: allProjects, error: allError } = await supabase
    .from('work_items')
    .select('*')
    .eq('type', 'assisted_project')
    .is('closed_at', null)

  if (allError) {
    console.error('Error fetching projects:', allError)
    process.exit(1)
  }

  // Find projects without emails
  const projectsWithoutEmails = []

  for (const project of allProjects || []) {
    const { data: comms } = await supabase
      .from('communications')
      .select('id')
      .eq('work_item_id', project.id)
      .limit(1)

    if (!comms || comms.length === 0) {
      projectsWithoutEmails.push(project)
    }
  }

  if (projectsWithoutEmails.length === 0) {
    console.log('✅ All custom projects already have emails!')
    return
  }

  console.log(`Found ${projectsWithoutEmails.length} projects without emails\n`)

  let linked = 0
  let skipped = 0

  for (const project of projectsWithoutEmails) {
    console.log(`\n🔍 ${project.customer_name || project.customer_email || 'Unknown'}`)
    console.log(`   Email: ${project.customer_email || 'N/A'}`)
    console.log(`   Shopify Order: ${project.shopify_order_number || 'N/A'}`)

    if (!project.customer_email && !project.shopify_order_number) {
      console.log(`   ⏭️  Skipped - No email or order number to search`)
      skipped++
      continue
    }

    // Strategy 1: Search by customer email (from or to)
    let foundEmails = []
    if (project.customer_email) {
      const { data: emailMatches } = await supabase
        .from('communications')
        .select('id, subject, received_at, direction, from_email')
        .or(`from_email.eq.${project.customer_email},to_emails.cs.{${project.customer_email}}`)
        .is('work_item_id', null)
        .order('received_at', { ascending: false })
        .limit(10)

      if (emailMatches && emailMatches.length > 0) {
        foundEmails = emailMatches
        console.log(`   📧 Found ${emailMatches.length} emails matching customer email`)
      }
    }

    // Strategy 2: Search by order number in email subject/body
    if (foundEmails.length === 0 && project.shopify_order_number) {
      const { data: orderMatches } = await supabase
        .from('communications')
        .select('id, subject, received_at, direction, from_email')
        .or(`subject.ilike.%${project.shopify_order_number}%,body_preview.ilike.%${project.shopify_order_number}%`)
        .is('work_item_id', null)
        .order('received_at', { ascending: false })
        .limit(10)

      if (orderMatches && orderMatches.length > 0) {
        foundEmails = orderMatches
        console.log(`   📧 Found ${orderMatches.length} emails mentioning order #${project.shopify_order_number}`)
      }
    }

    // Strategy 3: Check alternate_emails if available
    if (foundEmails.length === 0 && project.alternate_emails && project.alternate_emails.length > 0) {
      for (const altEmail of project.alternate_emails) {
        const { data: altMatches } = await supabase
          .from('communications')
          .select('id, subject, received_at, direction, from_email')
          .or(`from_email.eq.${altEmail},to_emails.cs.{${altEmail}}`)
          .is('work_item_id', null)
          .order('received_at', { ascending: false })
          .limit(10)

        if (altMatches && altMatches.length > 0) {
          foundEmails = altMatches
          console.log(`   📧 Found ${altMatches.length} emails matching alternate email: ${altEmail}`)
          break
        }
      }
    }

    if (foundEmails.length === 0) {
      console.log(`   ⏭️  No unlinked emails found`)
      skipped++
      continue
    }

    // Link all found emails
    const emailIds = foundEmails.map(e => e.id)
    const { error: updateError } = await supabase
      .from('communications')
      .update({
        work_item_id: project.id,
        triage_status: 'attached'
      })
      .in('id', emailIds)

    if (updateError) {
      console.error(`   ❌ Error linking emails:`, updateError.message)
      skipped++
    } else {
      console.log(`   ✅ Linked ${emailIds.length} emails!`)
      foundEmails.forEach(email => {
        console.log(`      - ${email.direction === 'inbound' ? 'FROM' : 'TO'} ${email.from_email}: ${email.subject || '(no subject)'}`)
      })
      linked++
    }
  }

  console.log('\n' + '='.repeat(80))
  console.log('📊 RESULTS')
  console.log('='.repeat(80))
  console.log(`✅ Projects with emails linked: ${linked}`)
  console.log(`⏭️  Projects still without emails: ${skipped}`)
  console.log(`📧 Total projects checked: ${projectsWithoutEmails.length}`)
  console.log('='.repeat(80))

  if (skipped > 0) {
    console.log('\n💡 For projects that still have no emails:')
    console.log('   - They may genuinely have no email communication (phone orders, etc.)')
    console.log('   - Customer might have used different email address')
    console.log('   - Emails may not have been imported yet')
    console.log('   - Use the "Find & Link Emails" feature in the work item UI')
  }
}

async function main() {
  try {
    await linkEmaillessProjects()
  } catch (error) {
    console.error('\n❌ Fatal error:', error)
    process.exit(1)
  }
}

main()
