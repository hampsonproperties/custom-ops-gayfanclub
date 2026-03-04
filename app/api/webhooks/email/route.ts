import { NextRequest, NextResponse } from 'next/server'
import { Client } from '@microsoft/microsoft-graph-client'
import { ClientSecretCredential } from '@azure/identity'
import 'isomorphic-fetch'
import { importEmail } from '@/lib/utils/email-import'
import { createClient } from '@supabase/supabase-js'
import { serverError } from '@/lib/api/errors'
import { logger } from '@/lib/logger'

const log = logger('email-webhook')

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
      log.info('Validation token received')
      return new NextResponse(validationToken, {
        status: 200,
        headers: { 'Content-Type': 'text/plain' },
      })
    }

    // Process notification
    const notification = JSON.parse(body)

    log.info('Notification received', { itemCount: notification.value?.length || 0 })

    // Process each notification — validate clientState to confirm it came from our subscription
    const expectedClientState = 'customOpsEmailSubscription'
    for (const item of notification.value || []) {
      if (item.clientState !== expectedClientState) {
        log.error('Rejected: invalid or missing clientState', { clientState: item.clientState })
        continue
      }
      if (item.changeType === 'created' && item.resourceData?.id) {
        await processEmailNotification(item)
      }
    }

    return NextResponse.json({ received: true })
  } catch (error) {
    log.error('Webhook handler error', { error })
    return serverError(error instanceof Error ? error.message : 'Webhook processing failed')
  }
}

async function processEmailNotification(notification: any) {
  try {
    const messageId = notification.resourceData.id
    const mailboxEmail = process.env.MICROSOFT_MAILBOX_EMAIL || 'sales@thegayfanclub.com'

    const client = getGraphClient()

    // Fetch the full email message
    const message = await client
      .api(`/users/${mailboxEmail}/messages/${messageId}`)
      .select(
        'id,internetMessageId,subject,from,toRecipients,body,receivedDateTime,sentDateTime,conversationId'
      )
      .get()

    log.info('Fetched message', { subject: message.subject })

    // Use shared import function (handles deduplication, categorization, auto-linking)
    const result = await importEmail(message, { mailboxEmail })

    if (result.success) {
      if (result.action === 'inserted') {
        log.info('Successfully imported', { communicationId: result.communicationId })
      } else if (result.action === 'duplicate') {
        log.info('Duplicate detected, skipped')
      }

      // Recalculate follow-up if email is inbound and linked to a work item
      if (result.workItemId && result.direction === 'inbound') {
        try {
          const supabase = createClient(supabaseUrl, supabaseServiceKey)
          const now = new Date().toISOString()

          // Update last_contact_at
          await supabase
            .from('work_items')
            .update({ last_contact_at: now })
            .eq('id', result.workItemId)

          // Recalculate next_follow_up_at
          const { data: nextFollowUp } = await supabase
            .rpc('calculate_next_follow_up', { work_item_id: result.workItemId })

          if (nextFollowUp !== undefined) {
            await supabase
              .from('work_items')
              .update({ next_follow_up_at: nextFollowUp })
              .eq('id', result.workItemId)
          }

          // Auto-remove "waiting on customer" flag if set
          await supabase
            .from('work_items')
            .update({ is_waiting: false })
            .eq('id', result.workItemId)
            .eq('is_waiting', true)

          log.info('Recalculated follow-up', { workItemId: result.workItemId })
        } catch (followUpError) {
          log.error('Error recalculating follow-up', { error: followUpError, workItemId: result.workItemId })
        }
      }
    } else {
      log.error('Import failed', { error: result.error })
    }
  } catch (error) {
    log.error('Error processing notification', { error })
  }
}
