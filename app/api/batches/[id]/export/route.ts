import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = createClient(supabaseUrl, supabaseServiceKey)
  const { id } = await params

  try {
    // Get batch with items
    const { data: batch, error: batchError } = await supabase
      .from('batches')
      .select('*')
      .eq('id', id)
      .single()

    if (batchError) throw batchError

    // Get batch items with work item details
    const { data: items, error: itemsError } = await supabase
      .from('batch_items')
      .select('*, work_item:work_items(*)')
      .eq('batch_id', id)
      .order('position', { ascending: true })

    if (itemsError) throw itemsError

    // Generate CSV
    const headers = [
      'Position',
      'Customer Name',
      'Customer Email',
      'Quantity',
      'Grip Color',
      'Shopify Order',
      'Design Fee Order',
      'Status',
      'Event Date',
    ]

    const rows = items.map((item: any) => {
      const workItem = item.work_item
      return [
        item.position,
        workItem.customer_name || '',
        workItem.customer_email || '',
        workItem.quantity || 0,
        workItem.grip_color || '',
        workItem.shopify_order_number || '',
        workItem.design_fee_order_number || '',
        workItem.status || '',
        workItem.event_date || '',
      ]
    })

    const csv = [
      headers.join(','),
      ...rows.map((row: any[]) =>
        row.map((cell: any) => {
          // Escape quotes and wrap in quotes if contains comma
          const str = String(cell)
          if (str.includes(',') || str.includes('"') || str.includes('\n')) {
            return `"${str.replace(/"/g, '""')}"`
          }
          return str
        }).join(',')
      ),
    ].join('\n')

    return new NextResponse(csv, {
      headers: {
        'Content-Type': 'text/csv',
        'Content-Disposition': `attachment; filename="${batch.name}.csv"`,
      },
    })
  } catch (error) {
    console.error('Batch export error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Export failed' },
      { status: 500 }
    )
  }
}
