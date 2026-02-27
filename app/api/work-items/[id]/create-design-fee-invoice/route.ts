import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createDesignFeeInvoice } from '@/lib/shopify/create-draft-order'

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

    // Check if design fee invoice already exists
    if (workItem.design_fee_order_id) {
      return NextResponse.json(
        { error: 'Design fee invoice already created for this lead' },
        { status: 400 }
      )
    }

    // Create Shopify draft order
    const result = await createDesignFeeInvoice(
      workItem.customer_email,
      workItem.customer_name || undefined,
      `Design fee invoice for ${workItem.customer_name || workItem.customer_email}`
    )

    if (!result.success) {
      return NextResponse.json(
        { error: result.error || 'Failed to create draft order' },
        { status: 500 }
      )
    }

    // Update work item with draft order info
    const { error: updateError } = await supabase
      .from('work_items')
      .update({
        design_fee_order_id: result.draftOrderId,
        design_fee_order_number: result.draftOrderNumber,
        shopify_customer_id: result.customerId,
        status: 'design_fee_sent',
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
    console.error('[API] Error creating design fee invoice:', error)
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    )
  }
}
