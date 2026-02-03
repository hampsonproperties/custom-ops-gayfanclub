import { NextResponse } from 'next/server'
import { Client } from '@microsoft/microsoft-graph-client'
import { ClientSecretCredential } from '@azure/identity'
import { createClient } from '@supabase/supabase-js'
import 'isomorphic-fetch'
import { importEmail, isJunkEmail } from '@/lib/utils/email-import'

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

export async function POST() {
  try {
    const supabase = createClient(supabaseUrl, supabaseServiceKey)
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://custom-ops-gayfanclub.vercel.app'
    const notificationUrl = `${baseUrl}/api/webhooks/email`

    // Check if we have an active subscription in our database
    const { data: existingSubscription } = await supabase
      .from('email_subscriptions')
      .select('*')
      .eq('status', 'active')
      .order('expires_at', { ascending: false })
      .limit(1)
      .single()

    const now = new Date()
    const renewalThreshold = new Date(now.getTime() + 24 * 60 * 60 * 1000) // 24 hours from now

    // If we have an active subscription that expires in more than 24 hours, we're good
    if (existingSubscription && new Date(existingSubscription.expires_at) > renewalThreshold) {
      return NextResponse.json({
        status: 'active',
        message: 'Subscription is active and valid',
        expiresAt: existingSubscription.expires_at,
        renewalNeeded: false,
      })
    }

    // Need to renew - either no subscription or expiring soon
    console.log('Email subscription needs renewal...')

    const client = getGraphClient()
    const mailboxEmail = process.env.MICROSOFT_MAILBOX_EMAIL || 'sales@thegayfanclub.com'

    // Delete old subscription if it exists
    if (existingSubscription?.subscription_id) {
      try {
        await client.api(`/subscriptions/${existingSubscription.subscription_id}`).delete()
        await supabase
          .from('email_subscriptions')
          .update({ status: 'expired' })
          .eq('id', existingSubscription.id)
      } catch (error) {
        console.log('Old subscription already deleted or expired:', error)
      }
    }

    // Create new subscription
    const subscription = await client.api('/subscriptions').post({
      changeType: 'created',
      notificationUrl: notificationUrl,
      resource: `/users/${mailboxEmail}/messages`,
      expirationDateTime: new Date(Date.now() + 4230 * 60 * 1000).toISOString(), // Max 4230 minutes (~3 days)
      clientState: 'customOpsEmailSubscription',
    })

    console.log('New email subscription created:', subscription.id)

    // Store in database
    await supabase.from('email_subscriptions').insert({
      subscription_id: subscription.id,
      resource: subscription.resource,
      notification_url: notificationUrl,
      expires_at: subscription.expirationDateTime,
      status: 'active',
    })

    // Also import any missed emails from the last 3 days
    console.log('[Subscription Check] Importing any missed emails...')
    try {
      const messages = await client
        .api(`/users/${mailboxEmail}/messages`)
        .select(
          'id,internetMessageId,subject,from,toRecipients,body,receivedDateTime,sentDateTime,conversationId'
        )
        .filter(`receivedDateTime ge ${new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString()}`)
        .top(50)
        .orderby('receivedDateTime desc')
        .get()

      let imported = 0
      let skipped = 0
      let filtered = 0

      for (const message of messages.value) {
        const fromEmail = message.from?.emailAddress?.address || 'unknown@unknown.com'

        // Skip junk
        if (isJunkEmail(fromEmail)) {
          filtered++
          continue
        }

        // Use shared import function (handles deduplication, categorization, auto-linking)
        const result = await importEmail(message, { mailboxEmail })

        if (result.success) {
          if (result.action === 'inserted') {
            imported++
          } else if (result.action === 'duplicate') {
            skipped++
          }
        }
      }

      console.log(
        `[Subscription Check] Missed emails: ${imported} imported, ${skipped} duplicates, ${filtered} junk`
      )
    } catch (importError) {
      console.error('[Subscription Check] Error importing missed emails:', importError)
      // Don't fail the renewal if import fails
    }

    return NextResponse.json({
      status: 'renewed',
      message: 'Subscription renewed successfully',
      subscriptionId: subscription.id,
      expiresAt: subscription.expirationDateTime,
      renewalNeeded: false,
    })
  } catch (error) {
    console.error('Subscription check/renewal error:', error)
    return NextResponse.json(
      {
        status: 'error',
        error: error instanceof Error ? error.message : 'Failed to check subscription',
      },
      { status: 500 }
    )
  }
}
