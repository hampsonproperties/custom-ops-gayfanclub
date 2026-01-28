import { NextRequest, NextResponse } from 'next/server'
import { Client } from '@microsoft/microsoft-graph-client'
import { ClientSecretCredential } from '@azure/identity'
import { createClient } from '@supabase/supabase-js'
import 'isomorphic-fetch'

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
        'internetMessageId,subject,from,toRecipients,body,receivedDateTime,conversationId,inReplyTo'
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
    const bodyPreview = bodyContent.replace(/<[^>]*>/g, '').substring(0, 200) // Strip HTML for preview

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
        triage_status: 'untriaged', // Goes to intake queue
        // Note: work_item_id is null - will be set during triage
      })
      .select()
      .single()

    if (insertError) {
      console.error('Failed to insert email:', insertError)
      return
    }

    console.log('Email imported successfully:', communication.id)

    // TODO: Check if this is a reply to an existing thread
    // If inReplyTo matches an existing outbound email, auto-link to work item

  } catch (error) {
    console.error('Error processing email notification:', error)
  }
}
