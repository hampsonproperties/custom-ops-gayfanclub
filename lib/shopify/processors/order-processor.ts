/**
 * Shopify Order Processor
 *
 * Handles orders/create and orders/updated webhook events.
 *
 * Three paths based on order type:
 * 1. Custom order (Customify / Design Service / Bulk) → create or update work item
 * 2. Stock order from a retail account → log to customer_orders only (no work item)
 * 3. Stock order from a regular customer → skip entirely
 *
 * Delegates sub-tasks to focused modules:
 * - data-extractors: Pure data parsing from Shopify payloads
 * - file-downloader: Customify file import
 * - email-auto-linker: Link unattached customer emails
 * - comment-sync: Sync Shopify timeline comments
 *
 * Uses existing helpers:
 * - detect-order-type: Determine order classification
 * - sync-customer-tags: Tag sync with pattern matching
 * - customer-orders: Customer master + order tracking
 */

import { SupabaseClient } from '@supabase/supabase-js'
import { detectOrderType } from '@/lib/shopify/detect-order-type'
import { syncCustomerTags } from '@/lib/shopify/sync-customer-tags'
import { createCustomerOrder, findOrCreateCustomer } from '@/lib/shopify/customer-orders'
import { extractCustomerData, extractLineItemData, extractPaymentHistory, determineStatus } from './data-extractors'
import { extractCustomifyFiles, importCustomifyFiles } from './file-downloader'
import { autoLinkEmails } from './email-auto-linker'
import { syncOrderComments } from './comment-sync'
import { logger } from '@/lib/logger'

const log = logger('shopify-order-processor')

/**
 * Process a Shopify order webhook (orders/create or orders/updated).
 *
 * Three paths:
 * 1. Custom order → create/update work item as normal
 * 2. Stock order + retail account match → log to customer_orders with retail_account_id
 * 3. Stock order + no match → skip, mark webhook completed
 */
export async function processOrder(
  supabase: SupabaseClient,
  order: any,
  webhookEventId: string
): Promise<void> {
  const orderType = detectOrderType(order)
  const { customerName, customerEmail, phoneNumber, companyName, address } = extractCustomerData(order)

  // Stock order — no custom products detected
  if (orderType === null) {
    await handleStockOrder(supabase, order, customerEmail, webhookEventId)
    return
  }

  // Custom order — create or update work item
  const existingWorkItem = await findExistingWorkItem(supabase, order, customerEmail, orderType)

  if (existingWorkItem) {
    await updateExistingWorkItem(supabase, existingWorkItem, order, orderType, customerName, customerEmail, phoneNumber, companyName, address, webhookEventId)
  } else {
    await createNewWorkItem(supabase, order, orderType, customerName, customerEmail, phoneNumber, companyName, address, webhookEventId)
  }
}

// ---------------------------------------------------------------------------
// Handle stock orders (no custom products detected)
// ---------------------------------------------------------------------------

async function handleStockOrder(
  supabase: SupabaseClient,
  order: any,
  customerEmail: string | null,
  webhookEventId: string
): Promise<void> {
  const shopifyCustomerId = order.customer?.id?.toString()
  const orderNumber = order.name

  // Check if this stock order already exists in customer_orders (orders/updated webhook)
  const { data: existingOrder } = await supabase
    .from('customer_orders')
    .select('id, retail_account_id')
    .eq('shopify_order_id', order.id.toString())
    .maybeSingle()

  if (existingOrder) {
    // Update existing customer_order record (financial/fulfillment status may have changed)
    await supabase
      .from('customer_orders')
      .update({
        financial_status: order.financial_status,
        fulfillment_status: order.fulfillment_status,
        total_price: order.total_price ? parseFloat(order.total_price) : null,
        shopify_updated_at: order.updated_at,
        updated_at: new Date().toISOString(),
      })
      .eq('id', existingOrder.id)

    log.info('Updated existing stock order in customer_orders', { orderNumber, customerOrderId: existingOrder.id })
    await markWebhookCompleted(supabase, webhookEventId)
    return
  }

  // Try to match to a retail account
  let retailAccountId = await findRetailAccount(supabase, shopifyCustomerId, customerEmail)

  // Faire orders: auto-create retail account if none exists
  if (!retailAccountId && isFaireOrder(order)) {
    retailAccountId = await createFaireRetailAccount(supabase, order)
    if (retailAccountId) {
      log.info('Auto-created retail account for Faire order', { orderNumber, retailAccountId })
    }
  }

  if (retailAccountId) {
    // Retail account match — log order against the account
    const customerId = await findOrCreateCustomer(supabase, order.customer)

    // Link customer to retail account and mark as retailer
    if (customerId) {
      await supabase
        .from('customers')
        .update({ customer_type: 'retailer', retail_account_id: retailAccountId })
        .eq('id', customerId)
        .is('retail_account_id', null) // Only set if not already linked
    }

    const orderTags = order.tags
      ?.split(',')
      .map((t: string) => t.trim())
      .filter(Boolean) || []

    const paymentHistory = extractPaymentHistory(order)

    await supabase.from('customer_orders').insert({
      customer_id: customerId,
      retail_account_id: retailAccountId,
      shopify_order_id: order.id.toString(),
      shopify_order_number: order.name,
      shopify_customer_id: shopifyCustomerId,
      order_type: 'stock_order',
      total_price: order.total_price ? parseFloat(order.total_price) : null,
      currency: order.currency || 'USD',
      financial_status: order.financial_status,
      fulfillment_status: order.fulfillment_status,
      payment_history: paymentHistory,
      tags: orderTags,
      note: order.note,
      line_items: order.line_items,
      shopify_created_at: order.created_at,
      shopify_updated_at: order.updated_at,
    })

    log.info('Stock order logged against retail account', {
      orderNumber,
      retailAccountId,
      total: order.total_price,
    })
  } else {
    // No retail account match — skip entirely
    log.info('Stock order skipped — no custom products, no retail account match', {
      orderNumber,
      customerEmail,
      shopifyCustomerId,
    })
  }

  await markWebhookCompleted(supabase, webhookEventId)
}

/**
 * Find a retail account by Shopify customer ID (primary) or email (fallback).
 */
async function findRetailAccount(
  supabase: SupabaseClient,
  shopifyCustomerId: string | null,
  customerEmail: string | null,
): Promise<string | null> {
  // Strategy 1: Match by Shopify customer ID (strongest match)
  if (shopifyCustomerId) {
    const { data } = await supabase
      .from('retail_accounts')
      .select('id')
      .eq('shopify_customer_id', shopifyCustomerId)
      .maybeSingle()

    if (data) return data.id
  }

  // Strategy 2: Match by email (primary_contact_email or billing_email)
  if (customerEmail) {
    const { data } = await supabase
      .from('retail_accounts')
      .select('id')
      .or(`primary_contact_email.ilike.${customerEmail},billing_email.ilike.${customerEmail}`)
      .limit(1)
      .maybeSingle()

    if (data) return data.id
  }

  return null
}

/**
 * Check if an order came from Faire marketplace.
 * Faire orders are always tagged "Faire, Wholesale" by the Shopify integration.
 */
function isFaireOrder(order: any): boolean {
  const tags = order.tags?.toLowerCase() || ''
  return tags.includes('faire') && tags.includes('wholesale')
}

/**
 * Auto-create a retail account from a Faire order's shipping data.
 *
 * Uses shopify_customer_id for future matching so repeat orders
 * from the same Faire buyer hit findRetailAccount() and skip this path.
 *
 * Does NOT save relay emails (@relay.faire.com) — primary_contact_email
 * is left blank intentionally.
 */
async function createFaireRetailAccount(
  supabase: SupabaseClient,
  order: any,
): Promise<string | null> {
  const shipping = order.shipping_address || {}
  const customer = order.customer || {}
  const shopifyCustomerId = customer.id?.toString()

  // Company name from shipping address, fall back to customer name
  const accountName = shipping.company
    || `${customer.first_name || ''} ${customer.last_name || ''}`.trim()
    || shipping.name
    || 'Unknown Faire Account'

  // Contact name from shipping address
  const contactName = shipping.name
    || `${customer.first_name || ''} ${customer.last_name || ''}`.trim()
    || null

  const { data, error } = await supabase
    .from('retail_accounts')
    .insert({
      account_name: accountName,
      account_type: 'retailer',
      shopify_customer_id: shopifyCustomerId,
      primary_contact_name: contactName,
      primary_contact_phone: shipping.phone || customer.phone || null,
      business_address: shipping.address1
        ? `${shipping.address1}${shipping.address2 ? ', ' + shipping.address2 : ''}`
        : null,
      city: shipping.city || null,
      state: shipping.province_code || null,
      zip_code: shipping.zip || null,
      country: shipping.country_code || 'US',
      status: 'active',
      tags: ['Faire'],
    })
    .select('id')
    .single()

  if (error) {
    log.error('Failed to auto-create Faire retail account', { error, orderNumber: order.name })
    return null
  }

  return data.id
}

// ---------------------------------------------------------------------------
// Find existing work item (4 strategies)
// ---------------------------------------------------------------------------

async function findExistingWorkItem(
  supabase: SupabaseClient,
  order: any,
  customerEmail: string | null,
  orderType: string,
): Promise<any | null> {
  const orderNumber = order.name
  const orderId = order.id?.toString()

  // Strategy 1: Match by order number
  const { data: byOrderNumber } = await supabase
    .from('work_items')
    .select('*')
    .eq('shopify_order_number', orderNumber)
    .maybeSingle()

  if (byOrderNumber) return byOrderNumber

  // Strategy 2: Match by design fee order number
  const { data: byDesignFee } = await supabase
    .from('work_items')
    .select('*')
    .eq('design_fee_order_number', orderNumber)
    .maybeSingle()

  if (byDesignFee) return byDesignFee

  // Strategy 3: For bulk orders, find an existing work item by customer email
  // that has a design fee but no production order yet
  if (orderType === 'custom_bulk_order' && customerEmail) {
    const { data: byEmail } = await supabase
      .from('work_items')
      .select('*')
      .eq('customer_email', customerEmail)
      .not('design_fee_order_id', 'is', null)
      .is('shopify_order_id', null)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (byEmail) return byEmail
  }

  // Strategy 4: Match by Shopify order ID
  const { data: byOrderId } = await supabase
    .from('work_items')
    .select('*')
    .eq('shopify_order_id', orderId)
    .maybeSingle()

  if (byOrderId) return byOrderId

  return null
}

// ---------------------------------------------------------------------------
// Update existing work item
// ---------------------------------------------------------------------------

async function updateExistingWorkItem(
  supabase: SupabaseClient,
  existingWorkItem: any,
  order: any,
  orderType: string,
  customerName: string | null,
  customerEmail: string | null,
  phoneNumber: string | null,
  companyName: string | null,
  address: string | null,
  webhookEventId: string
): Promise<void> {
  const updateData: any = {
    shopify_financial_status: order.financial_status,
    shopify_fulfillment_status: order.fulfillment_status,
  }

  // Fill in CRM fields that might be empty
  if (customerName && !existingWorkItem.customer_name) updateData.customer_name = customerName
  if (customerEmail && !existingWorkItem.customer_email) updateData.customer_email = customerEmail

  // Link this order to the work item
  if (orderType === 'custom_bulk_order') {
    updateData.shopify_order_id = order.id.toString()
    updateData.shopify_order_number = order.name

    if (order.financial_status === 'paid') {
      updateData.status = 'paid_ready_for_batch'
    } else if (order.financial_status === 'partially_paid') {
      updateData.status = 'deposit_paid_ready_for_batch'
    } else {
      updateData.status = 'invoice_sent'
    }
  } else if (orderType === 'custom_design_service') {
    updateData.design_fee_order_id = order.id.toString()
    updateData.design_fee_order_number = order.name

    if (order.financial_status === 'paid') {
      updateData.status = 'design_fee_paid'
    }
  } else {
    updateData.shopify_order_id = order.id.toString()
    updateData.shopify_order_number = order.name
  }

  // Extract payment history
  const paymentHistory = extractPaymentHistory(order)
  if (paymentHistory.length > 0) {
    updateData.payment_history = JSON.stringify(paymentHistory)
  }

  // Extract line item data
  const { quantity, gripColor } = extractLineItemData(order.line_items)
  if (quantity > 0) updateData.quantity = quantity
  if (gripColor) updateData.grip_color = gripColor

  await supabase
    .from('work_items')
    .update(updateData)
    .eq('id', existingWorkItem.id)

  // Create status event for the update
  await supabase.from('work_item_status_events').insert({
    work_item_id: existingWorkItem.id,
    from_status: existingWorkItem.status,
    to_status: updateData.status || existingWorkItem.status,
    note: `Updated via Shopify order ${order.name} (${orderType})`,
  })

  // Import Customify files for existing work item
  const customifyFiles = extractCustomifyFiles(order.line_items || [])
  if (customifyFiles.length > 0) {
    await importCustomifyFiles(supabase, existingWorkItem.id, customifyFiles, 'Imported from Customify via webhook update')
  }

  // Sync comments
  await syncOrderComments(supabase, order.id.toString(), existingWorkItem.id)

  // Mark webhook as completed
  await markWebhookCompleted(supabase, webhookEventId)
}

// ---------------------------------------------------------------------------
// Create new work item
// ---------------------------------------------------------------------------

async function createNewWorkItem(
  supabase: SupabaseClient,
  order: any,
  orderType: string,
  customerName: string | null,
  customerEmail: string | null,
  phoneNumber: string | null,
  companyName: string | null,
  address: string | null,
  webhookEventId: string
): Promise<void> {
  const { quantity, gripColor, designPreviewUrl, designDownloadUrl } = extractLineItemData(order.line_items)
  const customifyFiles = extractCustomifyFiles(order.line_items || [])

  const workItemType = (orderType === 'custom_design_service' || orderType === 'custom_bulk_order')
    ? 'assisted_project'
    : 'customify_order'

  const workItemStatus = determineStatus(orderType, order.financial_status)

  const insertData: any = {
    type: workItemType,
    source: 'shopify',
    status: workItemStatus,
    shopify_financial_status: order.financial_status,
    shopify_fulfillment_status: order.fulfillment_status,
    customer_name: customerName,
    customer_email: customerEmail,
    quantity,
    grip_color: gripColor,
    design_preview_url: designPreviewUrl,
    design_download_url: designDownloadUrl,
    reason_included: {
      detected_via: 'shopify_webhook',
      order_type: orderType,
      order_tags: order.tags,
      has_customify_properties: !!designPreviewUrl || !!designDownloadUrl,
    },
  }

  // Extract payment history
  const paymentHistory = extractPaymentHistory(order)
  if (paymentHistory.length > 0) {
    insertData.payment_history = JSON.stringify(paymentHistory)
  }

  // Assign order ID fields based on type
  if (orderType === 'custom_design_service') {
    insertData.design_fee_order_id = order.id.toString()
    insertData.design_fee_order_number = order.name
  } else {
    insertData.shopify_order_id = order.id.toString()
    insertData.shopify_order_number = order.name
  }

  // Check if this is a Shopify-first order (no prior email contact)
  if (workItemType === 'customify_order' && customerEmail) {
    const { data: existingCommunications } = await supabase
      .from('communications')
      .select('id')
      .ilike('from_email', customerEmail)
      .limit(1)

    insertData.requires_initial_contact = !existingCommunications || existingCommunications.length === 0
  }

  // Insert work item
  const { data: newWorkItem, error: insertError } = await supabase
    .from('work_items')
    .insert(insertData)
    .select()
    .single()

  if (insertError) {
    // Handle unique constraint violation (race condition)
    if (insertError.code === '23505') {
      const orderNumber = insertData.shopify_order_number || insertData.design_fee_order_number
      log.info('Duplicate prevented by unique constraint, skipping insert', { orderNumber })
      return
    }
    throw new Error(`Failed to create work item: ${insertError.message}`)
  }

  if (!newWorkItem) return

  // --- Post-insert operations (all independent, failures don't block each other) ---

  // Calculate follow-up date
  try {
    const { data: nextFollowUp } = await supabase
      .rpc('calculate_next_follow_up', { work_item_id: newWorkItem.id })

    if (nextFollowUp !== undefined) {
      await supabase
        .from('work_items')
        .update({ next_follow_up_at: nextFollowUp })
        .eq('id', newWorkItem.id)
    }
  } catch (followUpError) {
    log.error('Error calculating follow-up', { error: followUpError })
  }

  // Sync customer note
  const customerNote = order.customer?.note?.trim()
  if (customerNote && customerNote.length > 0) {
    await supabase.from('work_item_notes').insert({
      work_item_id: newWorkItem.id,
      content: `[Shopify Customer Note]\n${customerNote}`,
      author_email: 'shopify-sync@system',
      source: 'shopify',
      external_id: order.customer.id?.toString(),
      synced_at: new Date().toISOString(),
    })
  }

  // Sync customer tags
  const customerTags = order.customer?.tags
    ?.split(',')
    .map((t: string) => t.trim())
    .filter(Boolean) || []

  if (customerTags.length > 0) {
    const tagSyncResult = await syncCustomerTags(supabase, newWorkItem.id, customerTags)
    log.info('Synced tags to work item', { linked: tagSyncResult.linked, created: tagSyncResult.created, workItemId: newWorkItem.id })
    if (tagSyncResult.errors.length > 0) {
      log.error('Tag sync errors', { errors: tagSyncResult.errors })
    }
  }

  // Track order in customer_orders table
  await createCustomerOrder(supabase, order, orderType, newWorkItem.id)

  // Sync order comments (batch operation — N+1 fixed)
  await syncOrderComments(supabase, order.id.toString(), newWorkItem.id)

  // Import Customify files
  if (customifyFiles.length > 0) {
    await importCustomifyFiles(supabase, newWorkItem.id, customifyFiles)
  }

  // Auto-link recent emails
  if (customerEmail) {
    await autoLinkEmails(supabase, customerEmail, newWorkItem.id, order.created_at, orderType)
  }

  // Mark webhook as completed
  await markWebhookCompleted(supabase, webhookEventId)
}

// ---------------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------------

async function markWebhookCompleted(supabase: SupabaseClient, webhookEventId: string): Promise<void> {
  await supabase
    .from('webhook_events')
    .update({
      processing_status: 'completed',
      processed_at: new Date().toISOString(),
    })
    .eq('id', webhookEventId)
}
