import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { serverError } from '@/lib/api/errors'
import { logger } from '@/lib/logger'

const log = logger('batch-debug')


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
      .select('*, work_item:work_items(*, customer:customers(display_name, email, organization_name, phone))')
      .eq('batch_id', id)
      .order('position', { ascending: true })

    if (itemsError) throw itemsError

    const workItemIds = items.map((item: any) => item.work_item.id)

    // Get ALL files for these work items (not just design)
    const { data: allFiles, error: allFilesError } = await supabase
      .from('files')
      .select('*')
      .in('work_item_id', workItemIds)

    // Get just design files
    const { data: designFiles, error: designFilesError } = await supabase
      .from('files')
      .select('*')
      .in('work_item_id', workItemIds)
      .eq('kind', 'design')

    return NextResponse.json({
      batch: {
        id: batch.id,
        name: batch.name,
        status: batch.status,
      },
      workItems: items.map((item: any) => ({
        id: item.work_item.id,
        customer_name: item.work_item.customer?.display_name || item.work_item.customer_name,
      })),
      allFiles: allFiles?.map((f: any) => ({
        id: f.id,
        work_item_id: f.work_item_id,
        kind: f.kind,
        original_filename: f.original_filename,
        storage_bucket: f.storage_bucket,
        storage_path: f.storage_path,
        version: f.version,
      })),
      designFiles: designFiles?.map((f: any) => ({
        id: f.id,
        work_item_id: f.work_item_id,
        kind: f.kind,
        original_filename: f.original_filename,
        storage_bucket: f.storage_bucket,
        storage_path: f.storage_path,
        version: f.version,
      })),
      summary: {
        totalWorkItems: workItemIds.length,
        totalFiles: allFiles?.length || 0,
        designFiles: designFiles?.length || 0,
        filesByKind: allFiles?.reduce((acc: any, f: any) => {
          acc[f.kind] = (acc[f.kind] || 0) + 1
          return acc
        }, {}),
      }
    })
  } catch (error) {
    log.error('Debug error', { error })
    return serverError(error instanceof Error ? error.message : 'Debug failed')
  }
}
