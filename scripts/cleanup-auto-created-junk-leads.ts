/**
 * Cleanup Auto-Created Junk Leads
 *
 * Identifies and closes work items that were incorrectly auto-created from:
 * - Personal emails
 * - Notifications
 * - System emails that slipped through filters
 *
 * Run: npx tsx scripts/cleanup-auto-created-junk-leads.ts [--dry-run] [--close]
 */

import { config } from 'dotenv'
import { resolve } from 'path'
import { createClient } from '@supabase/supabase-js'

config({ path: resolve(process.cwd(), '.env.local') })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

const supabase = createClient(supabaseUrl, supabaseServiceKey)

// Flags
const isDryRun = process.argv.includes('--dry-run')
const shouldClose = process.argv.includes('--close')

// Known junk patterns that indicate non-customer emails
const JUNK_PATTERNS = {
  systemEmails: [
    /@paypal\./i,
    /@stripe\./i,
    /@square\./i,
    /@shopify\./i,
    /@apple\.com$/i,
    /@linkedin\./i,
    /@facebook\./i,
    /@twitter\./i,
    /@instagram\./i,
    /@tiktok\./i,
    /noreply@/i,
    /no-reply@/i,
    /donotreply@/i,
    /notifications@/i,
    /@notifications\./i,
    /@email\./i,
    /@newsletter\./i,
    /@marketing\./i,
    /automated@/i,
    /bounce@/i,
    /mailer-daemon@/i,
  ],

  notificationSubjects: [
    /order.*confirmation/i,
    /order.*placed/i,
    /order.*received/i,
    /tracking.*number/i,
    /shipped/i,
    /delivered/i,
    /invoice/i,
    /receipt/i,
    /payment.*received/i,
    /payment.*confirmation/i,
    /refund.*processed/i,
    /password.*reset/i,
    /verify.*email/i,
    /security.*alert/i,
    /unsubscribe/i,
    /subscription/i,
  ],

  personalDomains: [
    /@gmail\.com$/i,
    /@yahoo\.com$/i,
    /@hotmail\.com$/i,
    /@outlook\.com$/i,
    /@icloud\.com$/i,
    /@aol\.com$/i,
    /@proton\.me$/i,
    /@me\.com$/i,
  ],
}

interface JunkLead {
  id: string
  customer_name: string | null
  customer_email: string | null
  title: string | null
  status: string
  created_at: string
  reason_included: any
  reasons: string[]
}

async function analyzeAutoCreatedLeads() {
  console.log('🔍 Analyzing auto-created leads...\n')

  // Get work items that were auto-created from emails
  const { data: autoLeads, error } = await supabase
    .from('work_items')
    .select('id, customer_name, customer_email, title, status, created_at, reason_included, closed_at')
    .eq('source', 'email')
    .is('closed_at', null)
    .order('created_at', { ascending: false })

  if (error) {
    console.error('Error fetching work items:', error)
    process.exit(1)
  }

  console.log(`Total open email-sourced leads: ${autoLeads?.length || 0}\n`)

  // Categorize junk leads
  const junkLeads: JunkLead[] = []
  const validLeads: any[] = []

  for (const lead of autoLeads || []) {
    const email = lead.customer_email?.toLowerCase() || ''
    const title = lead.title?.toLowerCase() || ''
    const reasonIncluded = lead.reason_included as any
    const detectedVia = reasonIncluded?.detected_via

    // Only check items that were auto-created (not manually created)
    if (detectedVia !== 'auto_lead_primary_category') {
      validLeads.push(lead)
      continue
    }

    const reasons: string[] = []

    // Check for system email patterns
    if (JUNK_PATTERNS.systemEmails.some(pattern => pattern.test(email))) {
      reasons.push('System/notification email')
    }

    // Check for notification subject patterns
    if (JUNK_PATTERNS.notificationSubjects.some(pattern => pattern.test(title))) {
      reasons.push('Notification subject')
    }

    // Check for personal domains (these are likely not business inquiries)
    // Only flag if the email also lacks typical inquiry language
    const hasPersonalDomain = JUNK_PATTERNS.personalDomains.some(pattern => pattern.test(email))
    const hasInquiryLanguage = /\b(quote|pricing|interested|custom|order|question|inquiry)\b/i.test(title)

    if (hasPersonalDomain && !hasInquiryLanguage) {
      reasons.push('Personal email without inquiry language')
    }

    // Check for suspicious customer names (likely auto-extracted from email)
    const name = lead.customer_name?.toLowerCase() || ''
    if (name.includes('noreply') || name.includes('notifications')) {
      reasons.push('System sender name')
    }

    if (reasons.length > 0) {
      junkLeads.push({
        ...lead,
        reasons,
      })
    } else {
      validLeads.push(lead)
    }
  }

  // Display results
  console.log('='.repeat(80))
  console.log('📊 AUTO-CREATED LEADS ANALYSIS')
  console.log('='.repeat(80))
  console.log(`Total auto-created leads: ${autoLeads?.length || 0}`)
  console.log(`Valid leads: ${validLeads.length}`)
  console.log(`Junk leads: ${junkLeads.length}`)
  console.log('='.repeat(80))

  if (junkLeads.length > 0) {
    console.log(`\n🗑️  JUNK LEADS (${junkLeads.length} items):\n`)

    // Group by reason
    const byReason = new Map<string, JunkLead[]>()
    for (const lead of junkLeads) {
      for (const reason of lead.reasons) {
        if (!byReason.has(reason)) {
          byReason.set(reason, [])
        }
        byReason.get(reason)!.push(lead)
      }
    }

    for (const [reason, leads] of byReason.entries()) {
      console.log(`\n📌 ${reason} (${leads.length} items):`)
      leads.slice(0, 10).forEach(lead => {
        const daysSince = Math.floor((Date.now() - new Date(lead.created_at).getTime()) / (1000 * 60 * 60 * 24))
        console.log(`   - ${lead.customer_email || 'No email'}`)
        console.log(`     Subject: ${lead.title || 'N/A'}`)
        console.log(`     Status: ${lead.status} | Created: ${daysSince} days ago`)
        console.log(`     ID: ${lead.id}`)
      })
      if (leads.length > 10) {
        console.log(`   ... and ${leads.length - 10} more`)
      }
    }
  }

  console.log('\n' + '='.repeat(80))
  console.log('💡 ACTIONS')
  console.log('='.repeat(80))

  if (junkLeads.length === 0) {
    console.log('✅ No junk leads found!')
    return
  }

  if (isDryRun) {
    console.log('🔍 DRY RUN MODE - No changes will be made')
    console.log(`\n📋 Would close ${junkLeads.length} junk leads`)
  } else if (shouldClose) {
    console.log('🚀 Closing junk leads...\n')

    const junkIds = junkLeads.map(l => l.id)
    const { error: closeError } = await supabase
      .from('work_items')
      .update({
        status: 'closed_junk',
        closed_at: new Date().toISOString(),
        notes: 'Auto-closed: Incorrectly created from non-customer email',
      })
      .in('id', junkIds)

    if (closeError) {
      console.error('❌ Error closing leads:', closeError)
    } else {
      console.log(`✅ Successfully closed ${junkIds.length} junk leads`)

      // Also unlink any communications
      const { error: unlinkError } = await supabase
        .from('communications')
        .update({ work_item_id: null })
        .in('work_item_id', junkIds)

      if (unlinkError) {
        console.warn('⚠️  Warning: Could not unlink communications:', unlinkError)
      } else {
        console.log('✅ Unlinked communications from closed leads')
      }
    }
  } else {
    console.log('📋 USAGE:')
    console.log('   --dry-run    Preview what would be closed (no changes)')
    console.log('   --close      Actually close the junk leads')
    console.log('\nExamples:')
    console.log('   npx tsx scripts/cleanup-auto-created-junk-leads.ts --dry-run')
    console.log('   npx tsx scripts/cleanup-auto-created-junk-leads.ts --close')
  }

  // Export IDs for manual review
  if (junkLeads.length > 0 && !shouldClose) {
    console.log(`\n📋 Junk lead IDs (for manual review):`)
    console.log(junkLeads.map(l => l.id).join('\n'))
  }
}

analyzeAutoCreatedLeads()
