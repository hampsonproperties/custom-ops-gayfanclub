/**
 * Identify Email-Sourced Junk Leads
 *
 * Only looks at work items created FROM emails (not Shopify orders)
 *
 * Run: npx tsx scripts/identify-email-sourced-junk.ts
 */

import { config } from 'dotenv'
import { resolve } from 'path'
import { createClient } from '@supabase/supabase-js'

config({ path: resolve(process.cwd(), '.env.local') })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

const supabase = createClient(supabaseUrl, supabaseServiceKey)

async function identifyJunk() {
  console.log('🔍 Analyzing EMAIL-SOURCED work items only...\n')

  // Only get work items created from emails (not Shopify)
  const { data: emailItems, error } = await supabase
    .from('work_items')
    .select('id, customer_name, customer_email, title, status, source, type, created_at, reason_included, closed_at')
    .eq('source', 'email')
    .is('closed_at', null)
    .order('created_at', { ascending: false })

  if (error) {
    console.error('Error fetching work items:', error)
    process.exit(1)
  }

  console.log(`Total open EMAIL-SOURCED items: ${emailItems?.length || 0}\n`)

  // Categorize
  const categories = {
    autoCreatedJunk: [] as any[],
    backfillJunk: [] as any[],
    legitimate: [] as any[],
  }

  for (const item of emailItems || []) {
    const email = item.customer_email?.toLowerCase() || ''
    const title = item.title?.toLowerCase() || ''
    const reasonIncluded = item.reason_included as any
    const detectedVia = reasonIncluded?.detected_via || 'manual'

    // Check for junk patterns
    const isSystemEmail = /noreply|no-reply|notifications|@shopify|@paypal|@stripe|@bizee|boosterapps/i.test(email)
    const isPersonalEmail = /@gmail\.com$|@yahoo\.com$|@hotmail\.com$|@outlook\.com$|@icloud\.com$|@me\.com$/i.test(email)
    const hasInquiryKeywords = /\b(quote|pricing|interested|custom order|question|inquiry|wedding|party|batch|print|order issue|design)\b/i.test(title)
    const isReplyWithoutContext = title.startsWith('re: ') && !hasInquiryKeywords
    const isForward = title.startsWith('fwd:') || title.startsWith('fw:')
    const isNoSubject = title === '(no subject)'
    const isStoreCredit = /store credit|refund|return/i.test(title)
    const isInvitation = /you're invited|invitation|event invitation|rsvp/i.test(title)
    const isPartnerNotification = /partner account|account closure|account status|business account/i.test(title)
    const isW9Request = title === 'w9' || title === 're: w9'

    // Spam detection: excessive emojis, weird formatting, suspicious domains
    const hasExcessiveEmojis = (title.match(/[\u{1F300}-\u{1F9FF}]/gu) || []).length >= 3
    const hasWeirdFormatting = /&:|!!•●•!!|\*\*\*|===|###/.test(title)
    const isSpamDomain = /@.*\.in\d+@/i.test(email) // Numbered subdomain pattern common in spam
    const isSpam = hasExcessiveEmojis || hasWeirdFormatting || isSpamDomain

    // Business/networking communications (not customer inquiries)
    const isBusinessComm = /@nglcc\.org$/i.test(email) || /orientation video|networking event|chamber of commerce/i.test(title)

    let reason = ''
    let category: 'autoCreatedJunk' | 'backfillJunk' | 'legitimate' = 'legitimate'

    // Spam detection first
    if (isSpam) {
      reason = 'Spam/phishing email (excessive emojis or weird formatting)'
      category = detectedVia === 'auto_lead_primary_category' ? 'autoCreatedJunk' : 'backfillJunk'
    }
    // System emails are always junk
    else if (isSystemEmail) {
      reason = 'System/vendor email (Bizee, Booster, etc.)'
      if (detectedVia === 'auto_lead_primary_category') {
        category = 'autoCreatedJunk'
      } else {
        category = 'backfillJunk'
      }
    }
    // Business/networking communications
    else if (isBusinessComm) {
      reason = 'Business/networking communication (not customer inquiry)'
      category = detectedVia === 'auto_lead_primary_category' ? 'autoCreatedJunk' : 'backfillJunk'
    }
    // Invitations are not customer inquiries
    else if (isInvitation) {
      reason = 'Event invitation (not customer inquiry)'
      category = detectedVia === 'auto_lead_primary_category' ? 'autoCreatedJunk' : 'backfillJunk'
    }
    // Partner/business notifications
    else if (isPartnerNotification || isForward) {
      reason = isPartnerNotification ? 'Business/partner notification' : 'Forwarded email (not direct inquiry)'
      category = detectedVia === 'auto_lead_primary_category' ? 'autoCreatedJunk' : 'backfillJunk'
    }
    // W9 requests are existing customer admin, not new inquiries
    else if (isW9Request) {
      reason = 'W9 request (existing customer admin)'
      category = detectedVia === 'auto_lead_primary_category' ? 'autoCreatedJunk' : 'backfillJunk'
    }
    // No subject emails are junk
    else if (isNoSubject) {
      reason = 'No subject'
      category = detectedVia === 'auto_lead_primary_category' ? 'autoCreatedJunk' : 'backfillJunk'
    }
    // Store credit/returns are not new inquiries
    else if (isStoreCredit) {
      reason = 'Store credit/return (not new inquiry)'
      category = detectedVia === 'auto_lead_primary_category' ? 'autoCreatedJunk' : 'backfillJunk'
    }
    // Personal emails without inquiry language
    else if (isPersonalEmail && !hasInquiryKeywords && isReplyWithoutContext) {
      reason = 'Personal email reply without inquiry context'
      category = detectedVia === 'auto_lead_primary_category' ? 'autoCreatedJunk' : 'backfillJunk'
    }

    const itemWithReason = { ...item, reason, detectedVia }

    if (category === 'autoCreatedJunk') {
      categories.autoCreatedJunk.push(itemWithReason)
    } else if (category === 'backfillJunk') {
      categories.backfillJunk.push(itemWithReason)
    } else {
      categories.legitimate.push(itemWithReason)
    }
  }

  // Display results
  console.log('='.repeat(80))
  console.log('📊 EMAIL-SOURCED ITEMS BREAKDOWN')
  console.log('='.repeat(80))
  console.log(`Legitimate email inquiries: ${categories.legitimate.length}`)
  console.log(`Auto-created junk: ${categories.autoCreatedJunk.length}`)
  console.log(`Backfill junk: ${categories.backfillJunk.length}`)
  console.log('='.repeat(80))

  if (categories.autoCreatedJunk.length > 0) {
    console.log(`\n🗑️  AUTO-CREATED JUNK (${categories.autoCreatedJunk.length} items):`)
    console.log('These were created by the aggressive auto-lead feature (now disabled)\n')
    categories.autoCreatedJunk.forEach(item => {
      const daysSince = Math.floor((Date.now() - new Date(item.created_at).getTime()) / (1000 * 60 * 60 * 24))
      console.log(`   ❌ ${item.customer_email}`)
      console.log(`      Subject: ${item.title}`)
      console.log(`      Reason: ${item.reason}`)
      console.log(`      Status: ${item.status} | Age: ${daysSince} days`)
      console.log(`      ID: ${item.id}`)
      console.log()
    })
  }

  if (categories.backfillJunk.length > 0) {
    console.log(`\n🗑️  BACKFILL JUNK (${categories.backfillJunk.length} items):`)
    console.log('These were imported by a migration script (backfill_script or manual_import)\n')
    categories.backfillJunk.forEach(item => {
      const daysSince = Math.floor((Date.now() - new Date(item.created_at).getTime()) / (1000 * 60 * 60 * 24))
      console.log(`   ❌ ${item.customer_email}`)
      console.log(`      Subject: ${item.title}`)
      console.log(`      Reason: ${item.reason}`)
      console.log(`      Status: ${item.status} | Age: ${daysSince} days`)
      console.log(`      Detection: ${item.detectedVia}`)
      console.log(`      ID: ${item.id}`)
      console.log()
    })
  }

  if (categories.legitimate.length > 0) {
    console.log(`\n✅ LEGITIMATE EMAIL INQUIRIES (${categories.legitimate.length} items):`)
    console.log('These appear to be real customer inquiries\n')
    categories.legitimate.slice(0, 10).forEach(item => {
      console.log(`   ✓ ${item.customer_email}`)
      console.log(`     Subject: ${item.title}`)
      console.log(`     Status: ${item.status}`)
      console.log(`     ID: ${item.id}`)
      console.log()
    })
    if (categories.legitimate.length > 10) {
      console.log(`   ... and ${categories.legitimate.length - 10} more`)
    }
  }

  console.log('\n' + '='.repeat(80))
  console.log('💡 SUMMARY')
  console.log('='.repeat(80))
  console.log(`Total junk to clean up: ${categories.autoCreatedJunk.length + categories.backfillJunk.length}`)
  console.log(`  - Auto-created junk: ${categories.autoCreatedJunk.length}`)
  console.log(`  - Backfill junk: ${categories.backfillJunk.length}`)

  // Export IDs
  const allJunkIds = [
    ...categories.autoCreatedJunk.map(i => i.id),
    ...categories.backfillJunk.map(i => i.id),
  ]

  if (allJunkIds.length > 0) {
    console.log(`\n📋 Junk IDs to close:`)
    console.log(allJunkIds.join('\n'))
  }
}

identifyJunk()
