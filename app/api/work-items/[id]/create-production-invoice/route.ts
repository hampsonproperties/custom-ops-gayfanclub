import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createProductionInvoice } from '@/lib/shopify/create-draft-order'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await request.json()
    const supabase = await createClient()

    // Get work item
    const { data: workItem, error: fetchError } = await supabase
      .from('work_items')
      .select('*')
      .eq('id', id)
      .single()

    if (fetchError || !workItem) {
      return NextResponse.json(
        { error: 'Work item not found' },
        { status: 404 }
      )
    }

    if (!workItem.customer_email) {
      return NextResponse.json(
        { error: 'Customer email required to create invoice' },
        { status: 400 }
      )
    }

    // Check if production invoice already exists
    if (workItem.shopify_order_id) {
      return NextResponse.json(
        { error: 'Production invoice already created for this lead' },
        { status: 400 }
      )
    }

    // Get production total from request or estimated value
    const productionTotal = body.amount || workItem.estimated_value || 0

    if (productionTotal <= 0) {
      return NextResponse.json(
        { error: 'Production amount required' },
        { status: 400 }
      )
    }

    // Apply design fee credit if applicable
    const designFeeCredit = workItem.design_fee_order_id ? 250 : 0

    // Create Shopify draft order
    const result = await createProductionInvoice(
      workItem.customer_email,
      workItem.customer_name || undefined,
      productionTotal,
      designFeeCredit,
      body.productTitle || 'Custom Product Order',
      `Production invoice for ${workItem.customer_name || workItem.customer_email}`
    )

    if (!result.success) {
      return NextResponse.json(
        { error: result.error || 'Failed to create draft order' },
        { status: 500 }
      )
    }

    // Update work item with draft order info
    // Note: We store as shopify_draft_order_id, not shopify_order_id
    // shopify_order_id is set when customer actually pays
    const { error: updateError } = await supabase
      .from('work_items')
      .update({
        shopify_draft_order_id: result.draftOrderId,
        shopify_customer_id: result.customerId,
        status: 'invoice_sent',
      })
      .eq('id', id)

    if (updateError) {
      console.error('[API] Failed to update work item:', updateError)
      return NextResponse.json(
        { error: 'Failed to update work item with invoice details' },
        { status: 500 }
      )
    }

    // Create internal note
    const { data: { user } } = await supabase.auth.getUser()
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
    console.error('[API] Error creating production invoice:', error)
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    )
  }
}
