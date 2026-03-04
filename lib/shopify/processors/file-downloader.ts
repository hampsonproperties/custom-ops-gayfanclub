/**
 * Shopify File Downloader
 *
 * Downloads files from external URLs (e.g., Customify CDN) and uploads
 * them to Supabase Storage. Falls back to storing the external URL
 * if the download fails. Failed downloads are logged to the Dead Letter Queue.
 */

import { SupabaseClient } from '@supabase/supabase-js'
import { addToDLQ } from '@/lib/utils/dead-letter-queue'
import { logger } from '@/lib/logger'

const log = logger('shopify-file-downloader')

interface StoredFile {
  path: string
  sizeBytes: number
}

interface CustomifyFile {
  kind: string
  url: string
  filename: string
}

interface FileRecord {
  work_item_id: string
  kind: string
  version: number
  original_filename: string
  normalized_filename: string
  storage_bucket: string
  storage_path: string
  mime_type: string
  size_bytes: number | null
  uploaded_by_user_id: null
  note: string
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

/**
 * Extracts Customify file references from Shopify line item properties.
 * Looks for URLs in properties named "final design", "design", "cst-original-image", or "preview".
 */
export function extractCustomifyFiles(lineItems: any[]): CustomifyFile[] {
  const files: CustomifyFile[] = []

  for (const item of lineItems || []) {
    if (!item.properties || !Array.isArray(item.properties)) continue

    for (const prop of item.properties) {
      const propName = prop.name?.toLowerCase() || ''
      const propValue = prop.value

      if (propName.includes('final design') && propValue?.includes('http')) {
        files.push({ kind: 'design', url: propValue, filename: `final-design-${propName}` })
      } else if (propName.includes('design ') && !propName.includes('final') && propValue?.includes('http')) {
        files.push({ kind: 'preview', url: propValue, filename: `design-${propName}` })
      } else if (propName.includes('cst-original-image') && propValue?.includes('http')) {
        files.push({ kind: 'other', url: propValue, filename: `original-${propName}` })
      } else if (propName.includes('preview') && propValue?.includes('http')) {
        files.push({ kind: 'preview', url: propValue, filename: `preview-${propName}` })
      }
    }
  }

  return files
}

/**
 * Imports Customify files for a work item. Downloads each file and creates
 * file records in the database. If download fails, falls back to storing
 * the external URL as a reference.
 *
 * Skips import if the work item already has files attached.
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
        mime_type: 'image/png',
        size_bytes: storedFile.sizeBytes,
        uploaded_by_user_id: null,
        note,
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
        mime_type: 'image/png',
        size_bytes: null,
        uploaded_by_user_id: null,
        note: 'Customify file - download failed, external URL only',
      })
    }
  }

  if (fileRecords.length > 0) {
    await supabase.from('files').insert(fileRecords)
    log.info('Imported files for work item', { count: fileRecords.length, workItemId })
  }
}
