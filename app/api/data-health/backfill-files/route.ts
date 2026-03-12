import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { lookupCustomifyOrder } from '@/lib/customify/api'
import { extractCustomifyApiFiles, downloadAndStoreFile } from '@/lib/shopify/processors/file-downloader'
import { logger } from '@/lib/logger'

const log = logger('backfill-files')

/**
 * POST /api/data-health/backfill-files
 *
 * Re-imports files for all customify_order work items from the Customify API.
 * Replaces old Shopify-property-parsed files with clean, properly labeled ones.
 *
 * Query params:
 *   ?dry_run=true  — preview what would change without modifying anything
 *   ?work_item_id=xxx — backfill a single work item only
 */
export async function POST(request: Request) {
  const supabase = await createClient()
  const url = new URL(request.url)
  const dryRun = url.searchParams.get('dry_run') === 'true'
  const singleWorkItemId = url.searchParams.get('work_item_id')

  // Get all customify_order work items with their Shopify order IDs
  let query = supabase
    .from('work_items')
    .select('id, shopify_order_id, shopify_order_number, customer_name')
    .eq('type', 'customify_order')
    .not('shopify_order_id', 'is', null)

  if (singleWorkItemId) {
    query = query.eq('id', singleWorkItemId)
  }

  const { data: workItems, error: queryError } = await query

  if (queryError) {
    return NextResponse.json({ error: queryError.message }, { status: 500 })
  }

  const results = {
    total: workItems?.length || 0,
    updated: 0,
    skipped: 0,
    failed: 0,
    no_customify_data: 0,
    details: [] as any[],
  }

  for (const wi of workItems || []) {
    try {
      // Look up in Customify API
      const customifyOrder = await lookupCustomifyOrder(wi.shopify_order_id)

      if (!customifyOrder || !customifyOrder.details?.length) {
        results.no_customify_data++
        results.details.push({
          work_item_id: wi.id,
          order: wi.shopify_order_number,
          status: 'no_customify_data',
        })
        continue
      }

      // Extract structured files from Customify API
      const apiFiles = extractCustomifyApiFiles(customifyOrder)

      if (apiFiles.length === 0) {
        results.skipped++
        results.details.push({
          work_item_id: wi.id,
          order: wi.shopify_order_number,
          status: 'no_files_from_api',
        })
        continue
      }

      if (dryRun) {
        // Count existing files
        const { count } = await supabase
          .from('files')
          .select('id', { count: 'exact', head: true })
          .eq('work_item_id', wi.id)

        results.updated++
        results.details.push({
          work_item_id: wi.id,
          order: wi.shopify_order_number,
          customer: wi.customer_name,
          status: 'would_replace',
          existing_file_count: count || 0,
          new_file_count: apiFiles.length,
          new_files: apiFiles.map(f => ({ kind: f.kind, label: f.label })),
        })
        continue
      }

      // Delete existing files for this work item
      // (Storage files are left in place — they'll be overwritten or cleaned up later)
      const { data: existingFiles } = await supabase
        .from('files')
        .select('id, storage_bucket, storage_path')
        .eq('work_item_id', wi.id)

      if (existingFiles && existingFiles.length > 0) {
        // Delete from Supabase Storage where applicable
        const storagePaths = existingFiles
          .filter(f => f.storage_bucket === 'custom-ops-files')
          .map(f => f.storage_path)

        if (storagePaths.length > 0) {
          await supabase.storage.from('custom-ops-files').remove(storagePaths)
        }

        // Delete DB records
        await supabase.from('files').delete().eq('work_item_id', wi.id)
      }

      // Download and store new files from Customify API
      const fileRecords = []

      for (let i = 0; i < apiFiles.length; i++) {
        const file = apiFiles[i]
        const storedFile = await downloadAndStoreFile(supabase, file.url, wi.id, file.filename)

        if (storedFile) {
          fileRecords.push({
            work_item_id: wi.id,
            kind: file.kind,
            version: i + 1,
            original_filename: file.filename,
            normalized_filename: file.filename,
            storage_bucket: 'custom-ops-files',
            storage_path: storedFile.path,
            external_url: file.url,
            mime_type: 'image/png',
            size_bytes: storedFile.sizeBytes,
            uploaded_by_user_id: null,
            note: file.label,
            source: 'customify_api',
          })
        } else {
          fileRecords.push({
            work_item_id: wi.id,
            kind: file.kind,
            version: i + 1,
            original_filename: file.filename,
            normalized_filename: file.filename,
            storage_bucket: 'customify',
            storage_path: file.url,
            external_url: file.url,
            mime_type: 'image/png',
            size_bytes: null,
            uploaded_by_user_id: null,
            note: `${file.label} — download failed, external URL only`,
            source: 'customify_api',
          })
        }
      }

      if (fileRecords.length > 0) {
        await supabase.from('files').insert(fileRecords)
      }

      results.updated++
      results.details.push({
        work_item_id: wi.id,
        order: wi.shopify_order_number,
        customer: wi.customer_name,
        status: 'replaced',
        old_count: existingFiles?.length || 0,
        new_count: fileRecords.length,
        files: fileRecords.map(f => ({ kind: f.kind, note: f.note, source: f.source })),
      })

      log.info('Backfilled files for work item', {
        workItemId: wi.id,
        order: wi.shopify_order_number,
        fileCount: fileRecords.length,
      })
    } catch (error) {
      results.failed++
      results.details.push({
        work_item_id: wi.id,
        order: wi.shopify_order_number,
        status: 'error',
        error: error instanceof Error ? error.message : String(error),
      })
    }
  }

  return NextResponse.json({
    dry_run: dryRun,
    ...results,
  })
}
