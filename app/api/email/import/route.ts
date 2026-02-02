import { NextRequest, NextResponse } from 'next/server'
import { Client } from '@microsoft/microsoft-graph-client'
import { ClientSecretCredential } from '@azure/identity'
import { createClient } from '@supabase/supabase-js'
import 'isomorphic-fetch'
import { htmlToPlainText, smartTruncate } from '@/lib/utils/html-entities'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

function getGraphClient() {
  const credential = new ClientSecretCredential(
    process.env.MICROSOFT_TENANT_ID!,
    process.env.MICROSOFT_CLIENT_ID!,
    process.env.MICROSOFT_CLIENT_SECRET!
  )

  return Client.initWithMiddleware({
    authProvider: {
      getAccessToken: async () => {
        const token = await credential.getToken('https://graph.microsoft.com/.default')
        return token.token
      },
    },
  })
}

export async function POST(request: NextRequest) {
  try {
    const { limit = 100, daysBack = 60 } = await request.json()
    const mailboxEmail = process.env.MICROSOFT_MAILBOX_EMAIL || 'sales@thegayfanclub.com'

    const client = getGraphClient()
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // Calculate date filter (emails received after this date)
    const dateFilter = new Date()
    dateFilter.setDate(dateFilter.getDate() - daysBack)
    const dateFilterISO = dateFilter.toISOString()

    // Fetch recent emails with date filter
    const messages = await client
      .api(`/users/${mailboxEmail}/messages`)
      .select('internetMessageId,subject,from,toRecipients,body,receivedDateTime,conversationId,sentDateTime')
      .filter(`receivedDateTime ge ${dateFilterISO}`)
      .top(limit)
      .orderby('receivedDateTime desc')
      .get()

    console.log(`Fetched ${messages.value.length} emails from mailbox`)

    let imported = 0
    let skipped = 0
    let filtered = 0

    // Junk email patterns to skip
    const junkPatterns = [
      /^noreply@/i,
      /^no-reply@/i,
      /^donotreply@/i,
      /^do-not-reply@/i,
      /^automated@/i,
      /^notifications@/i,
      /^bounce@/i,
      /^mailer-daemon@/i,
    ]

    for (const message of messages.value) {
      // Extract sender email early for filtering
      const fromEmail = message.from?.emailAddress?.address || 'unknown@unknown.com'

      // Skip obvious junk emails
      const isJunk = junkPatterns.some(pattern => pattern.test(fromEmail))
      if (isJunk) {
        filtered++
        console.log(`Filtered junk email from: ${fromEmail}`)
        continue
      }

      // Check for duplicate
      const { data: existingEmail } = await supabase
        .from('communications')
        .select('id')
        .eq('internet_message_id', message.internetMessageId)
        .single()

      if (existingEmail) {
        skipped++
        continue
      }

      // Determine direction - if from sales@, it's outbound
      const isOutbound = fromEmail.toLowerCase() === mailboxEmail.toLowerCase()
      const direction = isOutbound ? 'outbound' : 'inbound'

      // Extract body content
      const bodyContent = message.body?.content || ''
      const plainText = htmlToPlainText(bodyContent)
      const bodyPreview = smartTruncate(plainText, 200)

      // Apply email filters to determine category (for inbound emails only)
      let category = 'primary' // Default category
      if (!isOutbound) {
        const { data: filterResult } = await supabase
          .rpc('apply_email_filters', { p_from_email: fromEmail })
          .maybeSingle() as { data: { matched_category: string; filter_id: string } | null }

        if (filterResult?.matched_category) {
          category = filterResult.matched_category
          console.log(`Applied filter: ${fromEmail} → ${category}`)
        }
      }

      // Try to auto-link to existing work item based on thread
      let workItemId = null
      let triageStatus = isOutbound ? 'archived' : 'untriaged'

      if (message.conversationId) {
        const { data: threadEmail } = await supabase
          .from('communications')
          .select('work_item_id')
          .eq('provider_thread_id', message.conversationId)
          .not('work_item_id', 'is', null)
          .limit(1)
          .single()

        if (threadEmail?.work_item_id) {
          workItemId = threadEmail.work_item_id
          triageStatus = 'attached'
          console.log(`Auto-linked email to work item ${workItemId} based on thread ${message.conversationId}`)
        }
      }

      // Create communication record
      const { error: insertError } = await supabase
        .from('communications')
        .insert({
          direction: direction,
          from_email: fromEmail,
          to_emails: message.toRecipients?.map((r: any) => r.emailAddress.address) || [],
          subject: message.subject || '(no subject)',
          body_html: bodyContent,
          body_preview: bodyPreview,
          received_at: message.receivedDateTime,
          sent_at: isOutbound ? message.sentDateTime : null,
          internet_message_id: message.internetMessageId,
          provider: 'm365',
          provider_message_id: message.id,
          provider_thread_id: message.conversationId,
          work_item_id: workItemId,
          triage_status: triageStatus,
          category: category,
          is_read: false,
        })

      if (insertError) {
        console.error('Failed to insert email:', insertError)
        continue
      }

      imported++
    }

    return NextResponse.json({
      success: true,
      imported,
      skipped,
      filtered,
      total: messages.value.length,
    })
  } catch (error) {
    console.error('Import error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to import emails' },
      { status: 500 }
    )
  }
}
