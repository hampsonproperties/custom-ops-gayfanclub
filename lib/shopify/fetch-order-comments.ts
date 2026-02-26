/**
 * Fetch Order Comments from Shopify Timeline
 *
 * Retrieves comments/events from Shopify order timeline via Admin API
 */

import { getShopifyCredentials } from './get-credentials'

interface ShopifyEvent {
  id: number
  created_at: string
  message: string
  author?: string
  verb?: string
}

interface OrderComment {
  id: string
  message: string
  author: string
  created_at: string
}

/**
 * Fetch all timeline events/comments for an order
 */
export async function fetchOrderComments(shopifyOrderId: string): Promise<OrderComment[]> {
  try {
    const { shop, accessToken } = await getShopifyCredentials()

    const response = await fetch(
      `https://${shop}/admin/api/2024-10/orders/${shopifyOrderId}/events.json`,
      {
        headers: {
          'X-Shopify-Access-Token': accessToken,
          'Content-Type': 'application/json',
        },
      }
    )

    if (!response.ok) {
      const error = await response.text()
      console.error(`[Shopify] Failed to fetch order events: ${response.status} ${error}`)
      return []
    }

    const data = await response.json()
    const events: ShopifyEvent[] = data.events || []

    // Filter for comment events and format them
    const comments: OrderComment[] = events
      .filter((event) => {
        // Comments typically have a message and are created by staff/customers
        return event.message && event.message.trim().length > 0
      })
      .map((event) => ({
        id: event.id.toString(),
        message: event.message,
        author: event.author || 'Shopify',
        created_at: event.created_at,
      }))

    return comments
  } catch (error) {
    console.error('[Shopify] Error fetching order comments:', error)
    return []
  }
}
