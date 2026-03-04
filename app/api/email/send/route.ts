import { NextRequest, NextResponse } from 'next/server'
import { Client } from '@microsoft/microsoft-graph-client'
import { ClientSecretCredential } from '@azure/identity'
import { createClient } from '@/lib/supabase/server'
import { validateBody } from '@/lib/api/validate'
import { sendEmailBody } from '@/lib/api/schemas'
import 'isomorphic-fetch'
import { logger } from '@/lib/logger'
import { unauthorized, serverError } from '@/lib/api/errors'

const log = logger('email-send')

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()

    // Check authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return unauthorized('Unauthorized')
    }

    const bodyResult = validateBody(await request.json(), sendEmailBody)
    if (bodyResult.error) return bodyResult.error
    const { to, cc, subject, body, customerId, projectId } = bodyResult.data

    // Initialize Microsoft Graph client
    const credential = new ClientSecretCredential(
      process.env.MICROSOFT_TENANT_ID!,
      process.env.MICROSOFT_CLIENT_ID!,
      process.env.MICROSOFT_CLIENT_SECRET!
    )

    const client = Client.initWithMiddleware({
      authProvider: {
        getAccessToken: async () => {
          const token = await credential.getToken('https://graph.microsoft.com/.default')
          return token.token
        },
      },
    })

    const mailboxEmail = process.env.MICROSOFT_MAILBOX_EMAIL || 'sales@thegayfanclub.com'

    // Build recipients
    const toRecipients = [{ emailAddress: { address: to } }]
    const ccRecipients = cc && cc.length > 0
      ? cc.map((email: string) => ({ emailAddress: { address: email } }))
      : undefined

    // Send email via Microsoft Graph
    await client
      .api(`/users/${mailboxEmail}/sendMail`)
      .post({
        message: {
          subject,
          body: {
            contentType: 'Text',
            content: body,
          },
          toRecipients,
          ccRecipients,
        },
        saveToSentItems: true,
      })

    // Fetch the sent message to get metadata
    let messageThreadId = null
    let internetMessageId = null

    try {
      const sentItems = await client
        .api(`/users/${mailboxEmail}/mailFolders/SentItems/messages`)
        .top(1)
        .orderby('sentDateTime desc')
        .select('conversationId,internetMessageId')
        .get()

      if (sentItems.value && sentItems.value.length > 0) {
        messageThreadId = sentItems.value[0].conversationId
        internetMessageId = sentItems.value[0].internetMessageId
      }
    } catch (error) {
      log.error('Failed to fetch sent message metadata', { error })
    }

    // Create communication record
    const commData: any = {
      direction: 'outbound',
      from_email: mailboxEmail,
      to_emails: [to, ...(cc || [])],
      subject,
      body_html: body.replace(/\n/g, '<br>'),
      body_preview: subject,
      sent_at: new Date().toISOString(),
      triage_status: 'triaged',
      provider: 'm365',
      provider_thread_id: messageThreadId,
      internet_message_id: internetMessageId,
    }

    if (projectId) {
      commData.work_item_id = projectId
    }

    if (customerId) {
      commData.customer_id = customerId
    }

    const { error: commError } = await supabase
      .from('communications')
      .insert(commData)

    if (commError) {
      log.error('Failed to log email to database', { error: commError })
    }

    // Create activity log entry
    await supabase
      .from('activity_logs')
      .insert({
        activity_type: 'email_sent',
        related_entity_type: projectId ? 'work_item' : 'customer',
        related_entity_id: projectId || customerId,
        customer_id: customerId,
        user_id: user.id,
        metadata: {
          subject,
          recipients: [to, ...(cc || [])]
        }
      })

    return NextResponse.json({
      success: true,
      message: 'Email sent successfully',
    })

  } catch (error) {
    log.error('Send email error', { error })
    return serverError(error instanceof Error ? error.message : 'Failed to send email')
  }
}
