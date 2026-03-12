/**
 * File Downloader & Importer
 *
 * Downloads files from external URLs (e.g., Customify CDN) and uploads
 * them to Supabase Storage. Falls back to storing the external URL
 * if the download fails. Failed downloads are logged to the Dead Letter Queue.
 *
 * Two import paths:
 * 1. Customify API (preferred) — structured design files from the API
 * 2. Shopify properties (legacy fallback) — URLs parsed from line item properties
 */

import { SupabaseClient } from '@supabase/supabase-js'
import { addToDLQ } from '@/lib/utils/dead-letter-queue'
import { logger } from '@/lib/logger'
import { lookupCustomifyOrder, type CustomifyOrder } from '@/lib/customify/api'

const log = logger('file-downloader')

interface StoredFile {
  path: string
  sizeBytes: number
}

interface CustomifyFile {
  kind: string
  url: string
  filename: string
  source: 'customify_api' | 'shopify_property'
  label: string // Human-readable label like "Full Front Mockup"
}

interface FileRecord {
  work_item_id: string
  kind: string
  version: number
  original_filename: string
  normalized_filename: string
  storage_bucket: string
  storage_path: string
  external_url: string
  mime_type: string
  size_bytes: number | null
  uploaded_by_user_id: null
  note: string
  source: string
}

/**
 * Downloads a file from an external URL and uploads it to Supabase Storage.
 * Returns the storage path and size, or null if the download fails.
 * Failed downloads are automatically logged to the Dead Letter Queue.
 */
export async function downloadAndStoreFile(
  supabase: SupabaseClient,
  externalUrl: string,
  workItemId: string,
  filename: string
): Promise<StoredFile | null> {
  try {
    let url = externalUrl
    if (url.startsWith('//')) {
      url = `https:${url}`
    }

    log.info('Downloading file', { url })

    const response = await fetch(url)
    if (!response.ok) {
      const errorMessage = `Failed to download file: ${response.status} ${response.statusText}`
      log.error('Failed to download file', { status: response.status, statusText: response.statusText })

      await addToDLQ({
        operationType: 'file_download',
        operationKey: `file:${workItemId}:${filename}`,
        errorMessage,
        errorStack: undefined,
        operationPayload: {
          externalUrl: url,
          workItemId,
          filename,
          httpStatus: response.status,
        },
      }).catch((dlqError) => {
        log.error('Failed to add to DLQ', { error: dlqError })
      })

      return null
    }

    const arrayBuffer = await response.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)
    const sizeBytes = buffer.length

    let extension = 'png'
    const urlExtension = url.split('.').pop()?.toLowerCase()
    if (urlExtension && ['png', 'jpg', 'jpeg', 'gif', 'webp', 'pdf'].includes(urlExtension)) {
      extension = urlExtension
    }

    const storagePath = `work-items/${workItemId}/${filename}.${extension}`

    const { error: uploadError } = await supabase.storage
      .from('custom-ops-files')
      .upload(storagePath, buffer, {
        contentType: response.headers.get('content-type') || 'image/png',
        upsert: true,
      })

    if (uploadError) {
      const errorMessage = `Failed to upload file to Supabase Storage: ${uploadError.message}`
      log.error('Failed to upload file to Supabase Storage', { error: uploadError.message })

      await addToDLQ({
        operationType: 'file_upload',
        operationKey: `file:${workItemId}:${filename}`,
        errorMessage,
        errorStack: undefined,
        operationPayload: {
          externalUrl: url,
          workItemId,
          filename,
          storagePath,
          uploadError: uploadError.message,
        },
      }).catch((dlqError) => {
        log.error('Failed to add to DLQ', { error: dlqError })
      })

      return null
    }

    log.info('Successfully stored file', { storagePath, sizeBytes })
    return { path: storagePath, sizeBytes }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error downloading/storing file'
    log.error('Error downloading/storing file', { error })

    await addToDLQ({
      operationType: 'file_download',
      operationKey: `file:${workItemId}:${filename}`,
      errorMessage,
      errorStack: error instanceof Error ? error.stack : undefined,
      operationPayload: {
        externalUrl,
        workItemId,
        filename,
      },
    }).catch((dlqError) => {
      log.error('Failed to add to DLQ', { error: dlqError })
    })

    return null
  }
}

// ---------------------------------------------------------------------------
// Customify API file extraction (preferred)
// ---------------------------------------------------------------------------

/**
 * Extracts design files from Customify API order data.
 * Returns structured files with clear labels:
 * - Full Front/Back = complete mockup render (product + design)
 * - Design Front/Back = isolated customer artwork only
 */
export function extractCustomifyApiFiles(customifyOrder: CustomifyOrder): CustomifyFile[] {
  const files: CustomifyFile[] = []

  for (const detail of customifyOrder.details || []) {
    const productLabel = detail.product_name || detail.product_id || 'unknown'

    if (detail.full_front) {
      files.push({
        kind: 'preview',
        url: detail.full_front,
        filename: `customify-full-front-${detail.request_id}`,
        source: 'customify_api',
        label: `Full Front Mockup — ${productLabel}`,
      })
    }
    if (detail.full_back) {
      files.push({
        kind: 'preview',
        url: detail.full_back,
        filename: `customify-full-back-${detail.request_id}`,
        source: 'customify_api',
        label: `Full Back Mockup — ${productLabel}`,
      })
    }
    if (detail.design_front) {
      files.push({
        kind: 'design',
        url: detail.design_front,
        filename: `customify-design-front-${detail.request_id}`,
        source: 'customify_api',
        label: `Customer Design (Front) — ${productLabel}`,
      })
    }
    if (detail.design_back) {
      files.push({
        kind: 'design',
        url: detail.design_back,
        filename: `customify-design-back-${detail.request_id}`,
        source: 'customify_api',
        label: `Customer Design (Back) — ${productLabel}`,
      })
    }
  }

  return files
}

// ---------------------------------------------------------------------------
// Shopify property file extraction (legacy fallback)
// ---------------------------------------------------------------------------

/**
 * Extracts Customify file references from Shopify line item properties.
 * Looks for URLs in properties named "final design", "design", "cst-original-image", or "preview".
 * This is the old/unreliable approach — prefer extractCustomifyApiFiles() when possible.
 */
export function extractCustomifyFiles(lineItems: any[]): CustomifyFile[] {
  const files: CustomifyFile[] = []

  for (const item of lineItems || []) {
    if (!item.properties || !Array.isArray(item.properties)) continue

    for (const prop of item.properties) {
      const propName = prop.name?.toLowerCase() || ''
      const propValue = prop.value

      if (propName.includes('final design') && propValue?.includes('http')) {
        files.push({ kind: 'design', url: propValue, filename: `final-design-${propName}`, source: 'shopify_property', label: `Final Design (${prop.name})` })
      } else if (propName.includes('design ') && !propName.includes('final') && propValue?.includes('http')) {
        files.push({ kind: 'preview', url: propValue, filename: `design-${propName}`, source: 'shopify_property', label: `Design Preview (${prop.name})` })
      } else if (propName.includes('cst-original-image') && propValue?.includes('http')) {
        files.push({ kind: 'other', url: propValue, filename: `original-${propName}`, source: 'shopify_property', label: `Original Image (${prop.name})` })
      } else if (propName.includes('preview') && propValue?.includes('http')) {
        files.push({ kind: 'preview', url: propValue, filename: `preview-${propName}`, source: 'shopify_property', label: `Preview (${prop.name})` })
      }
    }
  }

  return files
}

// ---------------------------------------------------------------------------
// Unified file import
// ---------------------------------------------------------------------------

/**
 * Imports design files for a Customify work item.
 *
 * Strategy:
 * 1. Try Customify API first — gives clean, structured design files
 * 2. Fall back to Shopify line item properties if API returns nothing
 * 3. Downloads each file to Supabase Storage (falls back to external URL if download fails)
 *
 * Each file record includes a `source` field ('customify_api' or 'shopify_property')
 * so the UI can clearly show where each file came from.
 *
 * Skips import if the work item already has files attached.
 */
export async function importDesignFiles(
  supabase: SupabaseClient,
  workItemId: string,
  shopifyOrderId: string,
  lineItems: any[],
  note: string = 'Auto-imported design files'
): Promise<void> {
  // Check if work item already has files
  const { data: existingFiles } = await supabase
    .from('files')
    .select('id')
    .eq('work_item_id', workItemId)
    .limit(1)

  if (existingFiles && existingFiles.length > 0) return

  // Step 1: Try Customify API (preferred — structured data)
  let files: CustomifyFile[] = []
  try {
    const customifyOrder = await lookupCustomifyOrder(shopifyOrderId)
    if (customifyOrder) {
      files = extractCustomifyApiFiles(customifyOrder)
      log.info('Got design files from Customify API', { count: files.length, shopifyOrderId })
    }
  } catch (error) {
    log.error('Customify API file lookup failed, falling back to Shopify properties', { error, shopifyOrderId })
  }

  // Step 2: Fall back to Shopify line item properties if API returned nothing
  if (files.length === 0) {
    files = extractCustomifyFiles(lineItems)
    if (files.length > 0) {
      log.info('Using Shopify property files as fallback', { count: files.length, shopifyOrderId })
    }
  }

  if (files.length === 0) return

  // Step 3: Download and store each file
  const fileRecords: FileRecord[] = []

  for (let index = 0; index < files.length; index++) {
    const file = files[index]
    const storedFile = await downloadAndStoreFile(supabase, file.url, workItemId, file.filename)

    if (storedFile) {
      fileRecords.push({
        work_item_id: workItemId,
        kind: file.kind,
        version: index + 1,
        original_filename: file.filename,
        normalized_filename: file.filename,
        storage_bucket: 'custom-ops-files',
        storage_path: storedFile.path,
        external_url: file.url,
        mime_type: 'image/png',
        size_bytes: storedFile.sizeBytes,
        uploaded_by_user_id: null,
        note: `${file.label} — ${note}`,
        source: file.source,
      })
    } else {
      fileRecords.push({
        work_item_id: workItemId,
        kind: file.kind,
        version: index + 1,
        original_filename: file.filename,
        normalized_filename: file.filename,
        storage_bucket: 'customify',
        storage_path: file.url,
        external_url: file.url,
        mime_type: 'image/png',
        size_bytes: null,
        uploaded_by_user_id: null,
        note: `${file.label} — download failed, external URL only`,
        source: file.source,
      })
    }
  }

  if (fileRecords.length > 0) {
    await supabase.from('files').insert(fileRecords)
    log.info('Imported design files for work item', {
      count: fileRecords.length,
      workItemId,
      sources: files.map(f => f.source).filter((v, i, a) => a.indexOf(v) === i),
    })
  }
}

/**
 * Legacy wrapper — kept for backwards compatibility.
 * New code should use importDesignFiles() instead.
 */
export async function importCustomifyFiles(
  supabase: SupabaseClient,
  workItemId: string,
  customifyFiles: CustomifyFile[],
  note: string = 'Imported from Customify and stored in Supabase'
): Promise<void> {
  if (customifyFiles.length === 0) return

  // Check if work item already has files
  const { data: existingFiles } = await supabase
    .from('files')
    .select('id')
    .eq('work_item_id', workItemId)
    .limit(1)

  if (existingFiles && existingFiles.length > 0) return

  const fileRecords: FileRecord[] = []

  for (let index = 0; index < customifyFiles.length; index++) {
    const file = customifyFiles[index]
    const storedFile = await downloadAndStoreFile(supabase, file.url, workItemId, file.filename)

    if (storedFile) {
      fileRecords.push({
        work_item_id: workItemId,
        kind: file.kind,
        version: index + 1,
        original_filename: file.filename,
        normalized_filename: file.filename,
        storage_bucket: 'custom-ops-files',
        storage_path: storedFile.path,
        external_url: file.url,
        mime_type: 'image/png',
        size_bytes: storedFile.sizeBytes,
        uploaded_by_user_id: null,
        note,
        source: file.source || 'shopify_property',
      })
    } else {
      fileRecords.push({
        work_item_id: workItemId,
        kind: file.kind,
        version: index + 1,
        original_filename: file.filename,
        normalized_filename: file.filename,
        storage_bucket: 'customify',
        storage_path: file.url,
        external_url: file.url,
        mime_type: 'image/png',
        size_bytes: null,
        uploaded_by_user_id: null,
        note: 'Customify file - download failed, external URL only',
        source: file.source || 'shopify_property',
      })
    }
  }

  if (fileRecords.length > 0) {
    await supabase.from('files').insert(fileRecords)
    log.info('Imported files for work item', { count: fileRecords.length, workItemId })
  }
}
