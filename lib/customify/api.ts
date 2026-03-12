import { logger } from '@/lib/logger'

const log = logger('customify-api')

const CUSTOMIFY_API_URL = 'https://mycustomify.com/API'

interface CustomifyOrderDetail {
  request_id: string
  product_id: string
  product_name: string
  product_price: string
  full_front: string
  full_back: string
  design_front: string
  design_back: string
}

export interface CustomifyOrder {
  order_id: string
  order_number: string
  shop_id: string
  currency: string
  customer_name: string
  customer_email: string
  status: string
  request_date: string
  details: CustomifyOrderDetail[]
}

function getConfig() {
  const apiKey = process.env.CUSTOMIFY_API_KEY
  const shopId = process.env.CUSTOMIFY_SHOP_ID
  if (!apiKey || !shopId) {
    throw new Error('CUSTOMIFY_API_KEY and CUSTOMIFY_SHOP_ID must be set')
  }
  return { apiKey, shopId }
}

/**
 * Check if a Shopify order exists in Customify (i.e., has custom designs).
 * Returns the Customify order data if found, null otherwise.
 */
export async function lookupCustomifyOrder(shopifyOrderId: string): Promise<CustomifyOrder | null> {
  try {
    const { apiKey, shopId } = getConfig()
    const url = `${CUSTOMIFY_API_URL}/orders/view/${shopifyOrderId}?shop_id=${shopId}`
    const response = await fetch(url, {
      headers: { Authorization: `Bearer ${apiKey}` },
    })

    if (!response.ok) {
      if (response.status === 404) return null
      log.error('Customify API error', { status: response.status, shopifyOrderId })
      return null
    }

    const data = await response.json()
    if (!data || (Array.isArray(data) && data.length === 0)) return null

    const order = Array.isArray(data) ? data[0] : data
    return order as CustomifyOrder
  } catch (error) {
    log.error('Customify API lookup failed', { error, shopifyOrderId })
    return null
  }
}

/**
 * Fetch all Customify orders (paginated).
 * Use for bulk sync operations.
 */
export async function fetchAllCustomifyOrders(options?: {
  createdAtMin?: string
  createdAtMax?: string
  limit?: number
}): Promise<CustomifyOrder[]> {
  try {
    const { apiKey, shopId } = getConfig()
    const params = new URLSearchParams({ shop_id: shopId, limit: String(options?.limit ?? 250) })
    if (options?.createdAtMin) params.set('created_at_min', options.createdAtMin)
    if (options?.createdAtMax) params.set('created_at_max', options.createdAtMax)

    const url = `${CUSTOMIFY_API_URL}/orders?${params}`
    const response = await fetch(url, {
      headers: { Authorization: `Bearer ${apiKey}` },
    })

    if (!response.ok) {
      log.error('Customify API fetch all failed', { status: response.status })
      return []
    }

    const data = await response.json()
    return (Array.isArray(data) ? data : []) as CustomifyOrder[]
  } catch (error) {
    log.error('Customify API fetch all failed', { error })
    return []
  }
}

/**
 * Check if a Shopify order ID corresponds to a real Customify custom order.
 * This is the source of truth — if Customify doesn't have it, it's a stock order.
 */
export async function isCustomifyOrder(shopifyOrderId: string): Promise<boolean> {
  const order = await lookupCustomifyOrder(shopifyOrderId)
  return order !== null
}
