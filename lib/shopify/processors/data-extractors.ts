/**
 * Shopify Order Data Extractors
 *
 * Pure functions that extract and transform data from Shopify order payloads.
 * No database calls — these are used by order-processor.ts.
 */

/**
 * Extracts customer contact information from a Shopify order.
 */
export function extractCustomerData(order: any) {
  const customer = order.customer || {}
  const shippingAddress = order.shipping_address || customer.default_address || {}

  return {
    customerName: `${customer.first_name || ''} ${customer.last_name || ''}`.trim() || shippingAddress.name || null,
    customerEmail: (customer.email || order.email || order.contact_email)?.toLowerCase() || null,
    phoneNumber: customer.phone || shippingAddress.phone || null,
    companyName: shippingAddress.company || null,
    address: shippingAddress.address1
      ? `${shippingAddress.address1}${shippingAddress.address2 ? ', ' + shippingAddress.address2 : ''}, ${shippingAddress.city}, ${shippingAddress.province_code} ${shippingAddress.zip}`
      : null,
  }
}

/**
 * Extracts payment transaction history from a Shopify order.
 */
export function extractPaymentHistory(order: any): any[] {
  return (order.transactions || []).map((tx: any) => ({
    transaction_id: tx.id?.toString(),
    amount: tx.amount,
    currency: tx.currency,
    status: tx.status,
    kind: tx.kind,
    gateway: tx.gateway,
    paid_at: tx.processed_at,
  }))
}

/**
 * Extracts quantity, grip color, and design URLs from Shopify line items.
 * Only processes custom items (Customify, custom, or bulk).
 */
export function extractLineItemData(lineItems: any[]): {
  quantity: number
  gripColor: string | null
  designPreviewUrl: string | null
  designDownloadUrl: string | null
} {
  let designPreviewUrl: string | null = null
  let designDownloadUrl: string | null = null
  let quantity = 0
  let gripColor: string | null = null

  for (const item of lineItems || []) {
    const title = item.title?.toLowerCase() || ''
    const hasCustomifyProps = item.properties && Array.isArray(item.properties) &&
      item.properties.some((prop: any) => prop.name?.toLowerCase().includes('customify'))

    const isCustomItem = hasCustomifyProps ||
      title.includes('customify') ||
      title.includes('custom') ||
      title.includes('bulk')

    if (!isCustomItem) continue

    if (item.properties) {
      const props = Array.isArray(item.properties) ? item.properties : []
      for (const prop of props) {
        const propName = prop.name?.toLowerCase() || ''
        const propValue = prop.value

        if (propName === 'design_preview' || propName === '_design_preview_url' || propName === 'preview') {
          designPreviewUrl = propValue
        }
        if (propName === 'design_download' || propName === '_design_download_url') {
          designDownloadUrl = propValue
        }
        if (propName === 'grip_color' || propName === 'grip color') {
          gripColor = propValue
        }
      }
    }

    // Extract quantity — try product title first, fall back to line item quantity
    const match = item.title?.match(/\((\d+)\s+(?:units?|fans?)/i)
    if (match) {
      quantity += parseInt(match[1], 10)
    } else {
      quantity += item.quantity
    }
  }

  return { quantity, gripColor, designPreviewUrl, designDownloadUrl }
}

/**
 * Determines the initial work item status based on order type and payment status.
 */
export function determineStatus(orderType: string, financialStatus: string): string {
  if (orderType === 'custom_design_service') {
    return financialStatus === 'paid' ? 'design_fee_paid' : 'design_fee_sent'
  }
  if (orderType === 'custom_bulk_order') {
    if (financialStatus === 'paid') return 'paid_ready_for_batch'
    if (financialStatus === 'partially_paid') return 'deposit_paid_ready_for_batch'
    return 'invoice_sent'
  }
  return 'needs_design_review'
}
