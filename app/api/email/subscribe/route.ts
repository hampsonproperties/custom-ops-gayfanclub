import { NextRequest, NextResponse } from 'next/server'
import { Client } from '@microsoft/microsoft-graph-client'
import { ClientSecretCredential } from '@azure/identity'
import { validateBody } from '@/lib/api/validate'
import { subscribeEmailBody, unsubscribeEmailBody } from '@/lib/api/schemas'
import 'isomorphic-fetch'
import { logger } from '@/lib/logger'
import { serverError } from '@/lib/api/errors'

const log = logger('email-subscribe')

export async function POST(request: NextRequest) {
  try {
    const bodyResult = validateBody(await request.json(), subscribeEmailBody)
    if (bodyResult.error) return bodyResult.error
    const { notificationUrl } = bodyResult.data

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

    // Create subscription for new messages
    const subscription = await client.api('/subscriptions').post({
      changeType: 'created',
      notificationUrl: notificationUrl,
      resource: `/users/${mailboxEmail}/messages`,
      expirationDateTime: new Date(Date.now() + 4230 * 60 * 1000).toISOString(), // Max 4230 minutes (~3 days)
      clientState: 'customOpsEmailSubscription', // Secret for validation
    })

    log.info('Email subscription created', { subscriptionId: subscription.id })

    return NextResponse.json({
      success: true,
      subscription: {
        id: subscription.id,
        resource: subscription.resource,
        expirationDateTime: subscription.expirationDateTime,
      },
    })
  } catch (error) {
    log.error('Subscription creation error', { error })
    return serverError(error instanceof Error ? error.message : 'Failed to create subscription')
  }
}

// GET endpoint to list active subscriptions
export async function GET() {
  try {
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

    const subscriptions = await client.api('/subscriptions').get()

    return NextResponse.json({
      subscriptions: subscriptions.value || [],
    })
  } catch (error) {
    log.error('Get subscriptions error', { error })
    return serverError(error instanceof Error ? error.message : 'Failed to get subscriptions')
  }
}

// DELETE endpoint to remove subscription
export async function DELETE(request: NextRequest) {
  try {
    const bodyResult = validateBody(await request.json(), unsubscribeEmailBody)
    if (bodyResult.error) return bodyResult.error
    const { subscriptionId } = bodyResult.data

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

    await client.api(`/subscriptions/${subscriptionId}`).delete()

    return NextResponse.json({ success: true })
  } catch (error) {
    log.error('Delete subscription error', { error })
    return serverError(error instanceof Error ? error.message : 'Failed to delete subscription')
  }
}
