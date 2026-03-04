import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createDesignFeeInvoice } from '@/lib/shopify/create-draft-order'
import { notFound, badRequest, serverError } from '@/lib/api/errors'
import { logger } from '@/lib/logger'

const log = logger('work-items-create-design-fee-invoice')

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const supabase = await createClient()

    // Get work item
    const { data: workItem, error: fetchError } = await supabase
      .from('work_items')
      .select('*')
      .eq('id', id)
      .single()

    if (fetchError || !workItem) {
      return notFound('Work item not found')
    }

    if (!workItem.customer_email) {
      return badRequest('Customer email required to create invoice')
    }

    // Check if design fee invoice already exists
    if (workItem.design_fee_order_id) {
      return badRequest('Design fee invoice already created for this lead')
    }

    // Create Shopify draft order
    const result = await createDesignFeeInvoice(
      workItem.customer_email,
      workItem.customer_name || undefined,
      `Design fee invoice for ${workItem.customer_name || workItem.customer_email}`
    )

    if (!result.success) {
      return serverError(result.error || 'Failed to create draft order')
    }

    // Update work item with draft order info + status change
    const oldStatus = workItem.status
    const newStatus = 'design_fee_sent'

    const { error: updateError } = await supabase
      .from('work_items')
      .update({
        design_fee_order_id: result.draftOrderId,
        design_fee_order_number: result.draftOrderNumber,
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
        note: `Design fee invoice created: ${result.draftOrderNumber}`,
      })
    }

    // Create internal note
    await supabase.from('work_item_notes').insert({
      work_item_id: id,
      content: `Created design fee invoice in Shopify: ${result.draftOrderNumber}\nInvoice URL: ${result.invoiceUrl}`,
      author_email: user?.email || 'system@gayfanclub.com',
    })

    return NextResponse.json({
      success: true,
      draftOrderId: result.draftOrderId,
      draftOrderNumber: result.draftOrderNumber,
      invoiceUrl: result.invoiceUrl,
    })
  } catch (error: any) {
    log.error('Error creating design fee invoice', { error })
    return serverError(error.message || 'Internal server error')
  }
}
