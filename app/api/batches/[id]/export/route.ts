import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import JSZip from 'jszip'
import { serverError } from '@/lib/api/errors'
import { logger } from '@/lib/logger'

const log = logger('batch-export')


export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient()
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

    // Get file records for all work items (preview version 2 - the "design-design 1" files)
    const workItemIds = items.map((item: any) => item.work_item.id)
    const { data: allFiles, error: filesError } = await supabase
      .from('files')
      .select('*')
      .in('work_item_id', workItemIds)
      .eq('kind', 'preview')

    if (filesError) throw filesError

    // Filter to get version 2 preview files (design-design 1)
    const files = allFiles?.filter((f: any) =>
      f.version === 2 || f.original_filename.includes('design-design')
    )

    log.info('Found preview files (version 2)', { fileCount: files?.length || 0, workItemCount: workItemIds.length })
    if (files) {
      files.forEach((f: any) => {
        log.info('Preview file details', { workItemId: f.work_item_id, filename: f.original_filename, version: f.version, storagePath: f.storage_path })
      })
    }

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
      let fileName = 'No file'
      if (designFile) {
        // Determine file extension from storage_path
        let extension = 'png' // default
        if (designFile.storage_path.includes('.')) {
          const pathExtension = designFile.storage_path.split('.').pop()?.toLowerCase()
          if (pathExtension && pathExtension.length <= 4) {
            extension = pathExtension
          }
        }
        fileName = `${index + 1}_${workItem.customer_name?.replace(/[^a-z0-9]/gi, '_') || 'design'}.${extension}`
      }

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
          log.info('Downloading file', { customerName: workItem.customer_name, storagePath: designFile.storage_path })

          // Check if storage_path is a URL or a Supabase path
          let fileData: ArrayBuffer
          if (designFile.storage_path.startsWith('http://') || designFile.storage_path.startsWith('https://')) {
            // It's a full URL - fetch directly
            const response = await fetch(designFile.storage_path)
            if (!response.ok) {
              throw new Error(`HTTP ${response.status}: ${response.statusText}`)
            }
            fileData = await response.arrayBuffer()
          } else {
            // It's a Supabase storage path
            const { data: supabaseFileData, error: downloadError } = await supabase
              .storage
              .from(designFile.storage_bucket)
              .download(designFile.storage_path)

            if (downloadError) {
              throw downloadError
            }
            if (!supabaseFileData) {
              throw new Error('No file data returned')
            }
            fileData = await supabaseFileData.arrayBuffer()
          }

          // Determine file extension
          let extension = 'png' // default
          if (designFile.storage_path.includes('.')) {
            const pathExtension = designFile.storage_path.split('.').pop()?.toLowerCase()
            if (pathExtension && pathExtension.length <= 4) {
              extension = pathExtension
            }
          }

          const fileName = `${i + 1}_${workItem.customer_name?.replace(/[^a-z0-9]/gi, '_') || 'design'}.${extension}`
          designsFolder.file(fileName, fileData)
          log.info('Added file to zip', { fileName, bytes: fileData.byteLength })
        } catch (error) {
          log.error('Failed to download file', { customerName: workItem.customer_name, error })
        }
      } else {
        log.info('No design file found', { customerName: workItem.customer_name })
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
    log.error('Batch export error', { error })
    return serverError(error instanceof Error ? error.message : 'Export failed')
  }
}
