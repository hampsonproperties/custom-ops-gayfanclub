/**
 * Shopify Webhook Manager
 *
 * Manages Shopify webhook subscriptions
 * Registers new webhooks for customers/*, refunds/*, etc.
 */

import { getShopifyCredentials } from './get-credentials'

interface WebhookRegistration {
  topic: string
  success: boolean
  error?: string
  webhookId?: string
}

/**
 * Register all required Shopify webhooks
 *
 * Topics:
 * - orders/create
 * - orders/updated
 * - fulfillments/create
 * - customers/create
 * - customers/update
 * - refunds/create
 *
 * @returns Array of registration results
 */
export async function registerWebhooks(): Promise<WebhookRegistration[]> {
  const topics = [
    'orders/create',
    'orders/updated',
    'fulfillments/create',
    'customers/create',
    'customers/update',
    'refunds/create',
  ]

  const results: WebhookRegistration[] = []

  for (const topic of topics) {
    const result = await registerWebhook(topic)
    results.push(result)
  }

  return results
}

/**
 * Register a single webhook
 *
 * @param topic - Webhook topic (e.g., 'customers/create')
 * @returns Registration result
 */
export async function registerWebhook(topic: string): Promise<WebhookRegistration> {
  try {
    const { shop, accessToken } = await getShopifyCredentials()

    // Check if webhook already exists
    const existingWebhook = await getExistingWebhook(shop, accessToken, topic)

    if (existingWebhook) {
      return {
        topic,
        success: true,
        webhookId: existingWebhook.id,
        error: 'Webhook already exists',
      }
    }

    // Create webhook
    const webhookUrl = `${process.env.NEXT_PUBLIC_APP_URL}/api/webhooks/shopify`

    const response = await fetch(`https://${shop}/admin/api/2024-01/webhooks.json`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Shopify-Access-Token': accessToken,
      },
      body: JSON.stringify({
        webhook: {
          topic,
          address: webhookUrl,
          format: 'json',
        },
      }),
    })

    const data = await response.json()

    if (!response.ok) {
      return {
        topic,
        success: false,
        error: data.errors || `Shopify API error: ${response.status}`,
      }
    }

    return {
      topic,
      success: true,
      webhookId: data.webhook?.id?.toString(),
    }
  } catch (error) {
    return {
      topic,
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}

/**
 * Get existing webhook for a topic
 *
 * @param shop - Shopify shop domain
 * @param accessToken - Shopify access token
 * @param topic - Webhook topic
 * @returns Existing webhook or null
 */
async function getExistingWebhook(
  shop: string,
  accessToken: string,
  topic: string
): Promise<{ id: string; topic: string } | null> {
  try {
    const response = await fetch(`https://${shop}/admin/api/2024-01/webhooks.json`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'X-Shopify-Access-Token': accessToken,
      },
    })

    const data = await response.json()

    if (!response.ok) {
      return null
    }

    const webhooks = data.webhooks || []
    const existing = webhooks.find((w: any) => w.topic === topic)

    return existing ? { id: existing.id?.toString(), topic: existing.topic } : null
  } catch (error) {
    console.error('Error fetching existing webhooks:', error)
    return null
  }
}

/**
 * List all registered webhooks
 *
 * @returns Array of webhooks
 */
export async function listWebhooks(): Promise<any[]> {
  try {
    const { shop, accessToken } = await getShopifyCredentials()

    const response = await fetch(`https://${shop}/admin/api/2024-01/webhooks.json`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'X-Shopify-Access-Token': accessToken,
      },
    })

    const data = await response.json()

    if (!response.ok) {
      console.error('Failed to list webhooks:', data)
      return []
    }

    return data.webhooks || []
  } catch (error) {
    console.error('Error listing webhooks:', error)
    return []
  }
}
