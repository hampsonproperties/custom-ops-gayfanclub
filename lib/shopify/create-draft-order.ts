/**
 * Create Shopify Draft Order
 * Allows creating invoices from CRM
 */

import { getShopifyCredentials } from './get-credentials'

export interface DraftOrderLineItem {
  title: string
  price: string
  quantity: number
  taxable?: boolean
}

export interface CreateDraftOrderParams {
  customerEmail: string
  customerName?: string
  lineItems: DraftOrderLineItem[]
  note?: string
  tags?: string[]
  metafields?: Array<{
    namespace: string
    key: string
    value: string
    type: string
  }>
}

export interface CreateDraftOrderResult {
  success: boolean
  draftOrderId?: string
  draftOrderNumber?: string
  customerId?: string
  invoiceUrl?: string
  error?: string
}

/**
 * Find or create Shopify customer
 */
async function findOrCreateCustomer(
  shop: string,
  accessToken: string,
  email: string,
  name?: string
): Promise<{ customerId: string; error?: string }> {
  try {
    // First, search for existing customer
    const searchResponse = await fetch(
      `https://${shop}/admin/api/2026-01/customers/search.json?query=email:${encodeURIComponent(email)}`,
      {
        headers: {
          'X-Shopify-Access-Token': accessToken,
          'Content-Type': 'application/json',
        },
      }
    )

    if (searchResponse.ok) {
      const searchData = await searchResponse.json()
      if (searchData.customers && searchData.customers.length > 0) {
        return { customerId: searchData.customers[0].id.toString() }
      }
    }

    // Customer doesn't exist, create new one
    const [firstName, ...lastNameParts] = (name || email.split('@')[0]).split(' ')
    const lastName = lastNameParts.join(' ') || ''

    const createResponse = await fetch(
      `https://${shop}/admin/api/2026-01/customers.json`,
      {
        method: 'POST',
        headers: {
          'X-Shopify-Access-Token': accessToken,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          customer: {
            email,
            first_name: firstName,
            last_name: lastName,
            tags: 'crm-created',
          },
        }),
      }
    )

    if (!createResponse.ok) {
      const error = await createResponse.text()
      console.error('[Shopify] Failed to create customer:', error)
      return { customerId: '', error: `Failed to create customer: ${error}` }
    }

    const createData = await createResponse.json()
    return { customerId: createData.customer.id.toString() }
  } catch (error: any) {
    console.error('[Shopify] Error finding/creating customer:', error)
    return { customerId: '', error: error.message }
  }
}

/**
 * Create draft order in Shopify
 */
export async function createDraftOrder(
  params: CreateDraftOrderParams
): Promise<CreateDraftOrderResult> {
  try {
    const { shop, accessToken } = await getShopifyCredentials()

    // Step 1: Find or create customer
    const { customerId, error: customerError } = await findOrCreateCustomer(
      shop,
      accessToken,
      params.customerEmail,
      params.customerName
    )

    if (customerError || !customerId) {
      return {
        success: false,
        error: customerError || 'Failed to find/create customer',
      }
    }

    // Step 2: Create draft order
    const draftOrderData = {
      draft_order: {
        customer: {
          id: customerId,
        },
        line_items: params.lineItems,
        note: params.note || '',
        tags: params.tags?.join(', ') || '',
        metafields: params.metafields || [],
        use_customer_default_address: true,
      },
    }

    const draftOrderResponse = await fetch(
      `https://${shop}/admin/api/2026-01/draft_orders.json`,
      {
        method: 'POST',
        headers: {
          'X-Shopify-Access-Token': accessToken,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(draftOrderData),
      }
    )

    if (!draftOrderResponse.ok) {
      const error = await draftOrderResponse.text()
      console.error('[Shopify] Failed to create draft order:', error)
      return {
        success: false,
        error: `Failed to create draft order: ${error}`,
      }
    }

    const draftOrderResult = await draftOrderResponse.json()
    const draftOrder = draftOrderResult.draft_order

    return {
      success: true,
      draftOrderId: draftOrder.id.toString(),
      draftOrderNumber: draftOrder.name,
      customerId,
      invoiceUrl: draftOrder.invoice_url,
    }
  } catch (error: any) {
    console.error('[Shopify] Error creating draft order:', error)
    return {
      success: false,
      error: error.message || 'Unknown error creating draft order',
    }
  }
}

/**
 * Preset: Create design fee invoice
 */
export async function createDesignFeeInvoice(
  customerEmail: string,
  customerName?: string,
  note?: string
): Promise<CreateDraftOrderResult> {
  return createDraftOrder({
    customerEmail,
    customerName,
    lineItems: [
      {
        title: 'Custom Design Service Fee',
        price: '250.00',
        quantity: 1,
        taxable: false,
      },
    ],
    note: note || 'Design fee for custom project',
    tags: ['design-fee', 'crm-created'],
  })
}

/**
 * Preset: Create production invoice
 */
export async function createProductionInvoice(
  customerEmail: string,
  customerName: string | undefined,
  productionTotal: number,
  designFeeCredit: number = 0,
  productTitle: string = 'Custom Product Order',
  note?: string
): Promise<CreateDraftOrderResult> {
  const lineItems: DraftOrderLineItem[] = [
    {
      title: productTitle,
      price: productionTotal.toFixed(2),
      quantity: 1,
      taxable: true,
    },
  ]

  // Add design fee credit if applicable
  if (designFeeCredit > 0) {
    lineItems.push({
      title: 'Design Fee Credit',
      price: `-${designFeeCredit.toFixed(2)}`,
      quantity: 1,
      taxable: false,
    })
  }

  return createDraftOrder({
    customerEmail,
    customerName,
    lineItems,
    note: note || 'Production invoice for custom order',
    tags: ['production', 'crm-created'],
  })
}
