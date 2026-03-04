/**
 * Push to Shopify Service
 *
 * Functions for pushing data back to Shopify via Admin API
 * Handles notes, tags, fulfillments, and metafields
 */

import { getShopifyCredentials } from '../get-credentials'
import { SHOPIFY_API_VERSION } from '@/lib/config'

interface PushResult {
  success: boolean
  error?: string
  response?: any
}

/**
 * Push a note to a Shopify customer
 *
 * Updates customer.note via Shopify Admin API
 *
 * @param customerId - Shopify customer ID
 * @param note - Note text to set
 * @returns Success status and response
 */
export async function pushNoteToShopify(
  customerId: string,
  note: string
): Promise<PushResult> {
  try {
    const { shop, accessToken } = await getShopifyCredentials()

    const response = await fetch(
      `https://${shop}/admin/api/${SHOPIFY_API_VERSION}/customers/${customerId}.json`,
      {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'X-Shopify-Access-Token': accessToken,
        },
        body: JSON.stringify({
          customer: {
            id: customerId,
            note,
          },
        }),
      }
    )

    const data = await response.json()

    if (!response.ok) {
      return {
        success: false,
        error: data.errors || `Shopify API error: ${response.status}`,
        response: data,
      }
    }

    return {
      success: true,
      response: data,
    }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error pushing note',
    }
  }
}

/**
 * Push tags to a Shopify customer
 *
 * Updates customer.tags via Shopify Admin API
 *
 * @param customerId - Shopify customer ID
 * @param tags - Array of tag strings
 * @returns Success status and response
 */
export async function pushTagsToShopify(
  customerId: string,
  tags: string[]
): Promise<PushResult> {
  try {
    const { shop, accessToken } = await getShopifyCredentials()

    // Join tags with commas as Shopify expects
    const tagsString = tags.join(', ')

    const response = await fetch(
      `https://${shop}/admin/api/${SHOPIFY_API_VERSION}/customers/${customerId}.json`,
      {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'X-Shopify-Access-Token': accessToken,
        },
        body: JSON.stringify({
          customer: {
            id: customerId,
            tags: tagsString,
          },
        }),
      }
    )

    const data = await response.json()

    if (!response.ok) {
      return {
        success: false,
        error: data.errors || `Shopify API error: ${response.status}`,
        response: data,
      }
    }

    return {
      success: true,
      response: data,
    }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error pushing tags',
    }
  }
}

/**
 * Push a fulfillment to a Shopify order
 *
 * Creates a fulfillment via Shopify Admin API
 *
 * @param orderId - Shopify order ID
 * @param fulfillmentData - Tracking and line item data
 * @returns Success status and response
 */
export async function pushFulfillmentToShopify(
  orderId: string,
  fulfillmentData: {
    tracking_number?: string
    tracking_url?: string
    tracking_company?: string
    line_items?: { id: string; quantity: number }[]
    notify_customer?: boolean
  }
): Promise<PushResult> {
  try {
    const { shop, accessToken } = await getShopifyCredentials()

    const fulfillment: any = {
      location_id: null, // Auto-select location
      tracking_number: fulfillmentData.tracking_number,
      tracking_url: fulfillmentData.tracking_url,
      tracking_company: fulfillmentData.tracking_company || 'Other',
      notify_customer: fulfillmentData.notify_customer !== false, // Default true
    }

    // Add line items if specified, otherwise fulfill all
    if (fulfillmentData.line_items && fulfillmentData.line_items.length > 0) {
      fulfillment.line_items = fulfillmentData.line_items.map((item) => ({
        id: item.id,
        quantity: item.quantity,
      }))
    }

    const response = await fetch(
      `https://${shop}/admin/api/${SHOPIFY_API_VERSION}/orders/${orderId}/fulfillments.json`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Shopify-Access-Token': accessToken,
        },
        body: JSON.stringify({ fulfillment }),
      }
    )

    const data = await response.json()

    if (!response.ok) {
      return {
        success: false,
        error: data.errors || `Shopify API error: ${response.status}`,
        response: data,
      }
    }

    return {
      success: true,
      response: data,
    }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error pushing fulfillment',
    }
  }
}

/**
 * Push a metafield to a Shopify resource
 *
 * Creates or updates a metafield via Shopify Admin API
 *
 * @param resourceType - Type of resource (customer, order, etc.)
 * @param resourceId - Shopify resource ID
 * @param metafield - Metafield data
 * @returns Success status and response
 */
export async function pushMetafieldToShopify(
  resourceType: 'customer' | 'order',
  resourceId: string,
  metafield: {
    namespace: string
    key: string
    value: string
    type: string // e.g., 'single_line_text_field', 'json'
  }
): Promise<PushResult> {
  try {
    const { shop, accessToken } = await getShopifyCredentials()

    const response = await fetch(
      `https://${shop}/admin/api/${SHOPIFY_API_VERSION}/${resourceType}s/${resourceId}/metafields.json`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Shopify-Access-Token': accessToken,
        },
        body: JSON.stringify({
          metafield: {
            namespace: metafield.namespace,
            key: metafield.key,
            value: metafield.value,
            type: metafield.type,
          },
        }),
      }
    )

    const data = await response.json()

    if (!response.ok) {
      return {
        success: false,
        error: data.errors || `Shopify API error: ${response.status}`,
        response: data,
      }
    }

    return {
      success: true,
      response: data,
    }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error pushing metafield',
    }
  }
}
