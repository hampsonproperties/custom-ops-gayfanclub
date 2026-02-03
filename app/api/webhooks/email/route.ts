import { NextRequest, NextResponse } from 'next/server'
import { Client } from '@microsoft/microsoft-graph-client'
import { ClientSecretCredential } from '@azure/identity'
import 'isomorphic-fetch'
import { importEmail } from '@/lib/utils/email-import'
import { createClient } from '@supabase/supabase-js'

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
      console.log('[Email Webhook] Validation received')
      return new NextResponse(validationToken, {
        status: 200,
        headers: { 'Content-Type': 'text/plain' },
      })
    }

    // Process notification
    const notification = JSON.parse(body)

    console.log('[Email Webhook] Notification received:', notification.value?.length || 0, 'items')

    // Process each notification
    for (const item of notification.value || []) {
      if (item.changeType === 'created' && item.resourceData?.id) {
        await processEmailNotification(item)
      }
    }

    return NextResponse.json({ received: true })
  } catch (error) {
    console.error('[Email Webhook] Error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Webhook processing failed' },
      { status: 500 }
    )
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

    console.log('[Email Webhook] Fetched message:', message.subject)

    // Use shared import function (handles deduplication, categorization, auto-linking)
    const result = await importEmail(message, { mailboxEmail })

    if (result.success) {
      if (result.action === 'inserted') {
        console.log('[Email Webhook] Successfully imported:', result.communicationId)
      } else if (result.action === 'duplicate') {
        console.log('[Email Webhook] Duplicate detected, skipped')
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

          console.log('[Email Webhook] Recalculated follow-up for work item:', result.workItemId)
        } catch (followUpError) {
          console.error('[Email Webhook] Error recalculating follow-up:', followUpError)
        }
      }
    } else {
      console.error('[Email Webhook] Import failed:', result.error)
    }
  } catch (error) {
    console.error('[Email Webhook] Error processing notification:', error)
  }
}
