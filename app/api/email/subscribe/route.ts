import { NextRequest, NextResponse } from 'next/server'
import { Client } from '@microsoft/microsoft-graph-client'
import { ClientSecretCredential } from '@azure/identity'
import 'isomorphic-fetch'

export async function POST(request: NextRequest) {
  try {
    const { notificationUrl } = await request.json()

    if (!notificationUrl) {
      return NextResponse.json(
        { error: 'notificationUrl required (e.g., https://your-domain.com/api/webhooks/email)' },
        { status: 400 }
      )
    }

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

    console.log('Email subscription created:', subscription.id)

    return NextResponse.json({
      success: true,
      subscription: {
        id: subscription.id,
        resource: subscription.resource,
        expirationDateTime: subscription.expirationDateTime,
      },
    })
  } catch (error) {
    console.error('Subscription error:', error)
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Failed to create subscription',
      },
      { status: 500 }
    )
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
    console.error('Get subscriptions error:', error)
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Failed to get subscriptions',
      },
      { status: 500 }
    )
  }
}

// DELETE endpoint to remove subscription
export async function DELETE(request: NextRequest) {
  try {
    const { subscriptionId } = await request.json()

    if (!subscriptionId) {
      return NextResponse.json({ error: 'subscriptionId required' }, { status: 400 })
    }

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
    console.error('Delete subscription error:', error)
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Failed to delete subscription',
      },
      { status: 500 }
    )
  }
}
