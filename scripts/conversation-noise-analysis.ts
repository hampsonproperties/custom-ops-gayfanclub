/**
 * Conversation Noise Analysis
 * What's causing 789 conversations to stay "active"?
 */

import { config } from 'dotenv'
import { resolve } from 'path'
import { createClient } from '@supabase/supabase-js'

config({ path: resolve(process.cwd(), '.env.local') })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

async function main() {
  console.log('🔍 CONVERSATION NOISE ANALYSIS\n')

  // Get sample of conversations with their emails
  const { data: convos } = await supabase
    .from('conversations')
    .select('id, subject, status, message_count, work_item_id, last_message_from, customer_id')
    .eq('status', 'active')
    .order('created_at', { ascending: false })
    .limit(100)

  console.log(`Analyzing ${convos?.length} conversations...\n`)

  // Check how many have work items vs not
  const withWorkItem = convos?.filter(c => c.work_item_id) || []
  const withoutWorkItem = convos?.filter(c => !c.work_item_id) || []

  console.log('📊 CONVERSATIONS BY WORK ITEM LINKAGE')
  console.log('-'.repeat(80))
  console.log(`✅ Linked to work item: ${withWorkItem.length}`)
  console.log(`❌ NOT linked to work item: ${withoutWorkItem.length}`)

  // For unlinked conversations, let's see what emails they contain
  console.log('\n\n📧 SAMPLE OF UNLINKED CONVERSATIONS (First 20)')
  console.log('-'.repeat(80))

  for (const convo of withoutWorkItem.slice(0, 20)) {
    // Get emails in this conversation
    const { data: emails } = await supabase
      .from('communications')
      .select('from_email, from_name, subject, category, direction')
      .eq('conversation_id', convo.id)
      .limit(1)

    const email = emails?.[0]
    if (!email) continue

    const isJunk =
      email.from_email?.includes('noreply') ||
      email.from_email?.includes('notifications') ||
      email.from_email?.includes('shopify') ||
      email.from_email?.includes('alibaba') ||
      email.from_email?.includes('tiktok') ||
      email.category === 'notifications' ||
      email.category === 'promotional'

    const flag = isJunk ? '🗑️ JUNK' : '📧 REAL?'
    console.log(`${flag} | ${email.category} | ${email.from_email}`)
    console.log(`     ${convo.subject}`)
    console.log()
  }

  // Check category distribution of emails in active conversations
  console.log('\n📊 EMAIL CATEGORIES IN ACTIVE CONVERSATIONS')
  console.log('-'.repeat(80))

  const { data: allEmailsInConvos } = await supabase
    .from('communications')
    .select('category')
    .in(
      'conversation_id',
      convos?.map(c => c.id) || []
    )

  const categoryBreakdown = allEmailsInConvos?.reduce((acc: any, email) => {
    acc[email.category] = (acc[email.category] || 0) + 1
    return acc
  }, {})

  console.table(categoryBreakdown)

  console.log('\n✅ Analysis complete!')
}

main()
