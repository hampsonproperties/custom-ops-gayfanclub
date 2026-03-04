/**
 * Investigate Custom Projects with No Emails
 *
 * Finds assisted_project work items that have no linked communications
 * and analyzes why they exist and how they were created
 *
 * Run: npx tsx scripts/investigate-emailless-projects.ts
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

async function investigateEmaillessProjects() {
  console.log('🔍 Finding custom projects with no emails...\n')

  // Get all assisted_project items
  const { data: allProjects, error: allError } = await supabase
    .from('work_items')
    .select('id')
    .eq('type', 'assisted_project')
    .is('closed_at', null)

  if (allError) {
    console.error('Error fetching all projects:', allError)
    process.exit(1)
  }

  console.log(`Total open custom projects: ${allProjects?.length || 0}\n`)

  // For each project, check if it has communications
  const projectsWithoutEmails = []

  for (const project of allProjects || []) {
    const { data: comms } = await supabase
      .from('communications')
      .select('id')
      .eq('work_item_id', project.id)
      .limit(1)

    if (!comms || comms.length === 0) {
      // No emails, fetch full details
      const { data: details } = await supabase
        .from('work_items')
        .select('*')
        .eq('id', project.id)
        .single()

      if (details) {
        projectsWithoutEmails.push(details)
      }
    }
  }

  if (projectsWithoutEmails.length === 0) {
    console.log('✅ All custom projects have at least one email!')
    return
  }

  console.log(`Found ${projectsWithoutEmails.length} custom projects with NO emails:\n`)
  console.log('='.repeat(80))

  // Analyze by source
  const bySource = new Map<string, typeof projectsWithoutEmails>()
  const byStatus = new Map<string, typeof projectsWithoutEmails>()

  for (const project of projectsWithoutEmails) {
    // Group by source
    if (!bySource.has(project.source)) {
      bySource.set(project.source, [])
    }
    bySource.get(project.source)!.push(project)

    // Group by status
    if (!byStatus.has(project.status)) {
      byStatus.set(project.status, [])
    }
    byStatus.get(project.status)!.push(project)
  }

  // Display breakdown by source
  console.log('\n📊 BREAKDOWN BY SOURCE:')
  console.log('─'.repeat(80))
  for (const [source, projects] of bySource.entries()) {
    console.log(`\n${source.toUpperCase()} (${projects.length} items):`)

    for (const project of projects.slice(0, 5)) { // Show first 5 from each source
      console.log(`  • ${project.customer_name || project.customer_email || 'Unknown'}`)
      console.log(`    Status: ${project.status}`)
      console.log(`    Email: ${project.customer_email || 'N/A'}`)
      console.log(`    Created: ${new Date(project.created_at).toLocaleDateString()}`)
      if (project.reason_included) {
        console.log(`    Reason: ${JSON.stringify(project.reason_included)}`)
      }
      console.log()
    }

    if (projects.length > 5) {
      console.log(`  ... and ${projects.length - 5} more`)
    }
  }

  // Display breakdown by status
  console.log('\n📊 BREAKDOWN BY STATUS:')
  console.log('─'.repeat(80))
  for (const [status, projects] of byStatus.entries()) {
    console.log(`  ${status}: ${projects.length}`)
  }

  console.log('\n')
  console.log('='.repeat(80))
  console.log('📊 ANALYSIS SUMMARY')
  console.log('='.repeat(80))
  console.log(`Total emailless projects: ${projectsWithoutEmails.length}`)
  console.log('\nBy Source:')
  for (const [source, projects] of bySource.entries()) {
    console.log(`  - ${source}: ${projects.length}`)
  }

  // Check if there are emails FROM these customers that aren't linked
  console.log('\n🔍 Checking for unlinked emails from these customers...\n')

  let foundUnlinked = 0
  for (const project of projectsWithoutEmails.slice(0, 10)) { // Check first 10
    if (!project.customer_email) continue

    const { data: unlinkedEmails } = await supabase
      .from('communications')
      .select('id, subject, received_at, from_email')
      .or(`from_email.eq.${project.customer_email},to_emails.cs.{${project.customer_email}}`)
      .is('work_item_id', null)
      .limit(5)

    if (unlinkedEmails && unlinkedEmails.length > 0) {
      console.log(`📧 ${project.customer_name || project.customer_email}:`)
      console.log(`   Found ${unlinkedEmails.length} unlinked emails!`)
      unlinkedEmails.forEach(email => {
        console.log(`   - ${email.subject || '(no subject)'} (${new Date(email.received_at).toLocaleDateString()})`)
      })
      console.log()
      foundUnlinked++
    }
  }

  if (foundUnlinked > 0) {
    console.log(`\n💡 Found unlinked emails for ${foundUnlinked} customers!`)
    console.log('   You may want to run the backfill script again or manually link these.')
  }

  console.log('\n💡 RECOMMENDATIONS:')
  console.log('─'.repeat(80))
  console.log('1. Projects from "manual" source are expected to have no emails')
  console.log('2. Projects from "email" or "form" SHOULD have emails')
  console.log('3. If they have customer_email but no linked emails, try:')
  console.log('   - Running the backfill script again')
  console.log('   - Manually linking emails via the UI')
  console.log('   - Checking if the customer email matches alternate_emails')
}

async function main() {
  try {
    await investigateEmaillessProjects()
  } catch (error) {
    console.error('\n❌ Fatal error:', error)
    process.exit(1)
  }
}

main()
