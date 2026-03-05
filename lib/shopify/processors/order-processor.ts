/**
 * Shopify Order Processor
 *
 * Handles orders/create and orders/updated webhook events.
 * Creates or updates work items based on order data.
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
import { createCustomerOrder } from '@/lib/shopify/customer-orders'
import { extractCustomerData, extractLineItemData, extractPaymentHistory, determineStatus } from './data-extractors'
import { extractCustomifyFiles, importCustomifyFiles } from './file-downloader'
import { autoLinkEmails } from './email-auto-linker'
import { syncOrderComments } from './comment-sync'
import { logger } from '@/lib/logger'

const log = logger('shopify-order-processor')

/**
 * Process a Shopify order webhook (orders/create or orders/updated).
 *
 * Two main paths:
 * 1. Existing work item found → update CRM fields + import files
 * 2. New order → create work item + import files + link emails + sync tags/comments
 */
export async function processOrder(
  supabase: SupabaseClient,
  order: any,
  webhookEventId: string
): Promise<void> {
  const orderType = detectOrderType(order) || 'customify_order'
  const { customerName, customerEmail, phoneNumber, companyName, address } = extractCustomerData(order)

  // Try to find an existing work item for this order
  const existingWorkItem = await findExistingWorkItem(supabase, order, customerEmail, orderType)

  if (existingWorkItem) {
    await updateExistingWorkItem(supabase, existingWorkItem, order, orderType, customerName, customerEmail, phoneNumber, companyName, address, webhookEventId)
  } else {
    await createNewWorkItem(supabase, order, orderType, customerName, customerEmail, phoneNumber, companyName, address, webhookEventId)
  }
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
    shopify_customer_id: order.customer?.id?.toString(),
    shopify_financial_status: order.financial_status,
    shopify_fulfillment_status: order.fulfillment_status,
  }

  // Fill in CRM fields that might be empty
  if (customerName && !existingWorkItem.customer_name) updateData.customer_name = customerName
  if (customerEmail && !existingWorkItem.customer_email) updateData.customer_email = customerEmail
  if (phoneNumber && !existingWorkItem.phone_number) updateData.phone_number = phoneNumber
  if (companyName && !existingWorkItem.company_name) updateData.company_name = companyName
  if (address && !existingWorkItem.address) updateData.address = address

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
    shopify_customer_id: order.customer?.id?.toString(),
    shopify_financial_status: order.financial_status,
    shopify_fulfillment_status: order.fulfillment_status,
    customer_name: customerName,
    customer_email: customerEmail,
    phone_number: phoneNumber,
    company_name: companyName,
    address: address,
    lead_source: 'shopify',
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
