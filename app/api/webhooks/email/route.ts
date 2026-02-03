import { NextRequest, NextResponse } from 'next/server'
import { Client } from '@microsoft/microsoft-graph-client'
import { ClientSecretCredential } from '@azure/identity'
import { createClient } from '@supabase/supabase-js'
import 'isomorphic-fetch'
import { htmlToPlainText, smartTruncate } from '@/lib/utils/html-entities'
import { autoCategorizEmail, EmailCategory } from '@/lib/utils/email-categorizer'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

// Microsoft Graph client setup
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
    const body = await request.text()
    const params = new URL(request.url).searchParams
    const validationToken = params.get('validationToken')

    // Microsoft Graph sends validation request when creating subscription
    if (validationToken) {
      console.log('Webhook validation received')
      return new NextResponse(validationToken, {
        status: 200,
        headers: { 'Content-Type': 'text/plain' },
      })
    }

    // Process notification
    const notification = JSON.parse(body)
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    console.log('Email notification received:', notification.value?.length || 0, 'items')

    // Process each notification
    for (const item of notification.value || []) {
      if (item.changeType === 'created' && item.resourceData?.id) {
        await processEmailNotification(item, supabase)
      }
    }

    return NextResponse.json({ received: true })
  } catch (error) {
    console.error('Email webhook error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Webhook processing failed' },
      { status: 500 }
    )
  }
}

async function processEmailNotification(notification: any, supabase: any) {
  try {
    const messageId = notification.resourceData.id
    const mailboxEmail = process.env.MICROSOFT_MAILBOX_EMAIL || 'sales@thegayfanclub.com'

    const client = getGraphClient()

    // Fetch the full email message
    const message = await client
      .api(`/users/${mailboxEmail}/messages/${messageId}`)
      .select(
        'internetMessageId,subject,from,toRecipients,body,receivedDateTime,conversationId'
      )
      .get()

    console.log('Fetched email:', message.subject)

    // Check for duplicate using internet_message_id
    const { data: existingEmail } = await supabase
      .from('communications')
      .select('id')
      .eq('internet_message_id', message.internetMessageId)
      .single()

    if (existingEmail) {
      console.log('Duplicate email detected, skipping:', message.internetMessageId)
      return
    }

    // Extract sender email
    const fromEmail = message.from?.emailAddress?.address || 'unknown@unknown.com'
    const fromName = message.from?.emailAddress?.name || fromEmail

    // Extract body content
    const bodyContent = message.body?.content || ''
    const plainText = htmlToPlainText(bodyContent)
    const bodyPreview = smartTruncate(plainText, 500)

    // Smart auto-categorization
    let category = autoCategorizEmail({
      from: fromEmail,
      subject: message.subject || '',
      body: plainText,
      htmlBody: bodyContent
    })
    console.log(`Auto-categorized: ${fromEmail} → ${category}`)

    // Check for manual filters (user overrides always win)
    const { data: filterResult } = await supabase
      .rpc('apply_email_filters', { p_from_email: fromEmail })
      .maybeSingle() as { data: { matched_category: string; filter_id: string } | null }

    if (filterResult?.matched_category) {
      category = filterResult.matched_category as EmailCategory
      console.log(`Manual filter override: ${fromEmail} → ${category}`)
    }

    // Try to auto-link to existing work item
    let workItemId = null
    let triageStatus = 'untriaged'

    // Strategy 1: Thread-based linking (always link if part of existing conversation)
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
        // Keep as 'untriaged' so it appears in inbox with project badge
        console.log(`Auto-linked email to work item ${workItemId} based on thread ${message.conversationId}`)
      }
    }

    // Strategy 2: Email-based linking with time window (only if not already linked by thread)
    if (!workItemId) {
      const emailReceivedDate = new Date(message.receivedDateTime)
      const lookbackDate = new Date(emailReceivedDate)
      lookbackDate.setDate(lookbackDate.getDate() - 60) // 60 day window

      // Check both primary email and alternate emails
      const { data: recentWorkItem } = await supabase
        .from('work_items')
        .select('id')
        .or(`customer_email.eq.${fromEmail},alternate_emails.cs.{${fromEmail}}`)
        .is('closed_at', null)
        .gte('updated_at', lookbackDate.toISOString())
        .order('updated_at', { ascending: false })
        .limit(1)
        .maybeSingle()

      if (recentWorkItem) {
        workItemId = recentWorkItem.id
        // Keep as 'untriaged' so it appears in inbox with project badge
        console.log(`Auto-linked email to work item ${workItemId} based on customer email (within 60 days)`)
      }
    }

    // Create communication record
    const { data: communication, error: insertError } = await supabase
      .from('communications')
      .insert({
        direction: 'inbound',
        from_email: fromEmail,
        to_emails: message.toRecipients?.map((r: any) => r.emailAddress.address) || [],
        subject: message.subject || '(no subject)',
        body_html: bodyContent,
        body_preview: bodyPreview,
        received_at: message.receivedDateTime,
        internet_message_id: message.internetMessageId,
        provider: 'm365',
        provider_message_id: message.id,
        provider_thread_id: message.conversationId,
        work_item_id: workItemId,
        triage_status: triageStatus,
        category: category,
        is_read: false,
      })
      .select()
      .single()

    if (insertError) {
      console.error('Failed to insert email:', insertError)
      return
    }

    console.log('Email imported successfully:', communication.id)

  } catch (error) {
    console.error('Error processing email notification:', error)
  }
}
