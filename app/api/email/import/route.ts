import { NextRequest, NextResponse } from 'next/server'
import { Client } from '@microsoft/microsoft-graph-client'
import { ClientSecretCredential } from '@azure/identity'
import { createClient } from '@supabase/supabase-js'
import 'isomorphic-fetch'

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
    const { limit = 25 } = await request.json()
    const mailboxEmail = process.env.MICROSOFT_MAILBOX_EMAIL || 'sales@thegayfanclub.com'

    const client = getGraphClient()
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // Fetch recent emails
    const messages = await client
      .api(`/users/${mailboxEmail}/messages`)
      .select('internetMessageId,subject,from,toRecipients,body,receivedDateTime,conversationId')
      .top(limit)
      .orderby('receivedDateTime desc')
      .get()

    console.log(`Fetched ${messages.value.length} emails from mailbox`)

    let imported = 0
    let skipped = 0

    for (const message of messages.value) {
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

      // Extract sender email
      const fromEmail = message.from?.emailAddress?.address || 'unknown@unknown.com'

      // Extract body content
      const bodyContent = message.body?.content || ''
      const bodyPreview = bodyContent.replace(/<[^>]*>/g, '').substring(0, 200)

      // Create communication record
      const { error: insertError } = await supabase
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
          triage_status: 'untriaged',
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
