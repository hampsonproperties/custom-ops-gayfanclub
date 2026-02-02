import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import JSZip from 'jszip'

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

    // Get file records for all work items
    const workItemIds = items.map((item: any) => item.work_item.id)
    const { data: files, error: filesError } = await supabase
      .from('files')
      .select('*')
      .in('work_item_id', workItemIds)
      .eq('file_type', 'proof')

    if (filesError) throw filesError

    // Generate enhanced CSV with payment status
    const headers = [
      'Position',
      'Customer Name',
      'Design Notes',
      'Quantity',
      'Grip Color',
      'Payment Status',
      'Shopify Order',
      'Design Fee Order',
      'Event Date',
      'Design File',
    ]

    const rows = items.map((item: any, index: number) => {
      const workItem = item.work_item

      // Determine payment status
      let paymentStatus = 'Unpaid'
      if (workItem.shopify_financial_status === 'paid') {
        paymentStatus = 'Paid'
      } else if (workItem.shopify_financial_status === 'partially_paid') {
        paymentStatus = 'Partially Paid'
      } else if (workItem.shopify_financial_status === 'pending') {
        paymentStatus = 'Pending'
      }

      // Find associated design file
      const designFile = files?.find((f: any) => f.work_item_id === workItem.id)
      const fileName = designFile ? `${index + 1}_${workItem.customer_name?.replace(/[^a-z0-9]/gi, '_') || 'design'}.${designFile.file_name.split('.').pop()}` : 'No file'

      return [
        item.position,
        workItem.customer_name || '',
        workItem.design_notes || workItem.title || '',
        workItem.quantity || 0,
        workItem.grip_color || '',
        paymentStatus,
        workItem.shopify_order_number || '',
        workItem.design_fee_order_number || '',
        workItem.event_date || '',
        fileName,
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

    // Create zip file
    const zip = new JSZip()

    // Add CSV manifest
    zip.file(`${batch.name}_manifest.csv`, csv)

    // Add design files
    const designsFolder = zip.folder('designs')

    for (let i = 0; i < items.length; i++) {
      const item = items[i]
      const workItem = item.work_item
      const designFile = files?.find((f: any) => f.work_item_id === workItem.id)

      if (designFile && designsFolder) {
        try {
          // Download file from Supabase Storage
          const { data: fileData, error: downloadError } = await supabase
            .storage
            .from('custom-ops-files')
            .download(designFile.storage_path)

          if (!downloadError && fileData) {
            const fileName = `${i + 1}_${workItem.customer_name?.replace(/[^a-z0-9]/gi, '_') || 'design'}.${designFile.file_name.split('.').pop()}`
            const arrayBuffer = await fileData.arrayBuffer()
            designsFolder.file(fileName, arrayBuffer)
          }
        } catch (error) {
          console.error(`Failed to download file for ${workItem.customer_name}:`, error)
        }
      }
    }

    // Add README
    const readme = `
# ${batch.name} - Supplier Package

This package contains all approved designs and production details for batch: ${batch.name}

## Contents:
- ${batch.name}_manifest.csv - Production manifest with all order details
- designs/ - Folder containing all approved design files

## Manifest Columns:
- Position: Order position in batch
- Customer Name: Name for the order
- Design Notes: Special instructions or design details
- Quantity: Number of units to produce
- Grip Color: Handle/grip color specification
- Payment Status: Paid, Partially Paid, Unpaid, or Pending
- Shopify Order: Shopify order number (if applicable)
- Design Fee Order: Separate design fee order number (if applicable)
- Event Date: Target event date (if provided)
- Design File: Corresponding file name in designs/ folder

## Production Notes:
- All designs in this batch are approved and ready for production
- Verify quantities and colors before production
- Contact customer service for any questions or clarifications

Generated: ${new Date().toISOString()}
Batch Status: ${batch.status}
${batch.tracking_number ? `Tracking Number: ${batch.tracking_number}` : ''}
`.trim()

    zip.file('README.txt', readme)

    // Generate zip as blob
    const zipBlob = await zip.generateAsync({ type: 'nodebuffer' })

    return new NextResponse(new Uint8Array(zipBlob), {
      headers: {
        'Content-Type': 'application/zip',
        'Content-Disposition': `attachment; filename="${batch.name}_supplier_package.zip"`,
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
