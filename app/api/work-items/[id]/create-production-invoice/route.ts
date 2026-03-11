import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createProductionInvoice } from '@/lib/shopify/create-draft-order'
import { DESIGN_FEE_AMOUNT } from '@/lib/config'
import { validateBody, validateParams } from '@/lib/api/validate'
import { createInvoiceBody, idParams } from '@/lib/api/schemas'
import { notFound, badRequest, serverError } from '@/lib/api/errors'
import { logger } from '@/lib/logger'

const log = logger('work-items-create-production-invoice')

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const paramResult = validateParams(await params, idParams)
    if (paramResult.error) return paramResult.error
    const { id } = paramResult.data

    const bodyResult = validateBody(await request.json(), createInvoiceBody)
    if (bodyResult.error) return bodyResult.error
    const body = bodyResult.data

    const supabase = await createClient()

    // Get work item
    const { data: workItem, error: fetchError } = await supabase
      .from('work_items')
      .select('*, customer:customers(display_name, email, organization_name, phone)')
      .eq('id', id)
      .single()

    if (fetchError || !workItem) {
      return notFound('Work item not found')
    }

    const customerEmail = workItem.customer?.email || workItem.customer_email
    const customerName = workItem.customer?.display_name || workItem.customer_name

    if (!customerEmail) {
      return badRequest('Customer email required to create invoice')
    }

    // Check if production invoice already exists
    if (workItem.shopify_order_id) {
      return badRequest('Production invoice already created for this lead')
    }

    // Get production total from request or estimated value
    const productionTotal = body.amount || workItem.estimated_value || 0

    if (productionTotal <= 0) {
      return badRequest('Production amount required')
    }

    // Apply design fee credit if applicable
    const designFeeCredit = workItem.design_fee_order_id ? DESIGN_FEE_AMOUNT : 0

    // Create Shopify draft order
    const result = await createProductionInvoice(
      customerEmail,
      customerName || undefined,
      productionTotal,
      designFeeCredit,
      body.productTitle || 'Custom Product Order',
      `Production invoice for ${customerName || customerEmail}`
    )

    if (!result.success) {
      return serverError(result.error || 'Failed to create draft order')
    }

    // Update work item with draft order info + status change
    // Note: We store as shopify_draft_order_id, not shopify_order_id
    // shopify_order_id is set when customer actually pays
    const oldStatus = workItem.status
    const newStatus = 'invoice_sent'

    const { error: updateError } = await supabase
      .from('work_items')
      .update({
        shopify_draft_order_id: result.draftOrderId,
        shopify_customer_id: result.customerId,
        status: newStatus,
      })
      .eq('id', id)

    if (updateError) {
      log.error('Failed to update work item', { error: updateError })
      return serverError('Failed to update work item with invoice details')
    }

    // Create audit trail for status change
    const { data: { user } } = await supabase.auth.getUser()
    if (oldStatus !== newStatus) {
      await supabase.from('work_item_status_events').insert({
        work_item_id: id,
        from_status: oldStatus,
        to_status: newStatus,
        changed_by_user_id: user?.id || null,
        note: `Production invoice created: ${result.draftOrderNumber}`,
      })
    }

    // Create internal note
    await supabase.from('work_item_notes').insert({
      work_item_id: id,
      content: `Created production invoice in Shopify: ${result.draftOrderNumber}\nAmount: $${productionTotal}${designFeeCredit > 0 ? ` (with $${designFeeCredit} design fee credit)` : ''}\nInvoice URL: ${result.invoiceUrl}`,
      author_email: user?.email || 'system@gayfanclub.com',
    })

    return NextResponse.json({
      success: true,
      draftOrderId: result.draftOrderId,
      draftOrderNumber: result.draftOrderNumber,
      invoiceUrl: result.invoiceUrl,
    })
  } catch (error: any) {
    log.error('Error creating production invoice', { error })
    return serverError(error.message || 'Internal server error')
  }
}
