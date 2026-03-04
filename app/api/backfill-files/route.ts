import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'
import { addToDLQ } from '@/lib/utils/dead-letter-queue'
import { serverError } from '@/lib/api/errors'
import { logger } from '@/lib/logger'

const log = logger('api-backfill-files')

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

/**
 * Backfill endpoint to download all existing Customify files and store them in Supabase
 * This is a one-time migration to take ownership of all design files
 */

/**
 * Downloads a file from an external URL and uploads it to Supabase Storage
 * @returns { path: string, sizeBytes: number } or null if download fails
 */
async function downloadAndStoreFile(
  supabase: any,
  externalUrl: string,
  workItemId: string,
  filename: string
): Promise<{ path: string; sizeBytes: number } | null> {
  try {
    // Ensure URL has protocol
    let url = externalUrl
    if (url.startsWith('//')) {
      url = `https:${url}`
    }

    log.info('Downloading file', { url })

    // Download file from external URL
    const response = await fetch(url)
    if (!response.ok) {
      const errorMessage = `Failed to download file: ${response.status} ${response.statusText}`
      log.error('Failed to download file', { status: response.status, statusText: response.statusText })

      // Add to DLQ for retry
      await addToDLQ({
        operationType: 'file_download',
        operationKey: `backfill:${workItemId}:${filename}`,
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

    // Determine file extension from URL or content-type
    let extension = 'png'
    const urlExtension = url.split('.').pop()?.toLowerCase()
    if (urlExtension && ['png', 'jpg', 'jpeg', 'gif', 'webp', 'pdf'].includes(urlExtension)) {
      extension = urlExtension
    }

    // Generate storage path: work-items/{id}/{filename}.{ext}
    const storagePath = `work-items/${workItemId}/${filename}.${extension}`

    // Upload to Supabase Storage
    const { error: uploadError } = await supabase.storage
      .from('custom-ops-files')
      .upload(storagePath, buffer, {
        contentType: response.headers.get('content-type') || 'image/png',
        upsert: true,
      })

    if (uploadError) {
      const errorMessage = `Failed to upload file to Supabase Storage: ${uploadError.message}`
      log.error('Failed to upload file to Supabase Storage', { error: uploadError.message })

      // Add to DLQ for retry
      await addToDLQ({
        operationType: 'file_upload',
        operationKey: `backfill:${workItemId}:${filename}`,
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

    // Add to DLQ for retry
    await addToDLQ({
      operationType: 'file_download',
      operationKey: `backfill:${workItemId}:${filename}`,
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

export async function POST(request: Request) {
  try {
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // Get all files that are stored in 'customify' bucket (external URLs)
    const { data: customifyFiles, error: filesError } = await supabase
      .from('files')
      .select('id, work_item_id, storage_path, original_filename, kind, version')
      .eq('storage_bucket', 'customify')
      .order('created_at', { ascending: true })

    if (filesError) {
      log.error('Error fetching Customify files', { error: filesError })
      return NextResponse.json({
        error: 'Failed to fetch files',
        details: filesError.message,
        code: filesError.code
      }, { status: 500 })
    }

    if (!customifyFiles || customifyFiles.length === 0) {
      return NextResponse.json({
        message: 'No Customify files found to backfill',
        processed: 0,
        successful: 0,
        failed: 0
      })
    }

    log.info('Found Customify files to backfill', { count: customifyFiles.length })

    const results = {
      total: customifyFiles.length,
      successful: 0,
      failed: 0,
      errors: [] as any[]
    }

    // Process each file
    for (const file of customifyFiles) {
      try {
        // storage_path contains the external Customify URL
        const externalUrl = file.storage_path

        // Download and store the file
        const storedFile = await downloadAndStoreFile(
          supabase,
          externalUrl,
          file.work_item_id,
          file.original_filename || `file-${file.kind}`
        )

        if (storedFile) {
          // Update the file record to point to our storage
          const { error: updateError } = await supabase
            .from('files')
            .update({
              storage_bucket: 'custom-ops-files',
              storage_path: storedFile.path,
              size_bytes: storedFile.sizeBytes,
              note: `Backfilled from Customify (was: ${externalUrl})`
            })
            .eq('id', file.id)

          if (updateError) {
            log.error('Failed to update file record', { fileId: file.id, error: updateError })
            results.failed++
            results.errors.push({ fileId: file.id, error: updateError.message })
          } else {
            results.successful++
            log.info('Backfilled file', { fileId: file.id })
          }
        } else {
          results.failed++
          results.errors.push({
            fileId: file.id,
            error: 'Failed to download file from external URL'
          })
        }
      } catch (error) {
        log.error('Error processing file', { fileId: file.id, error })
        results.failed++
        results.errors.push({
          fileId: file.id,
          error: error instanceof Error ? error.message : 'Unknown error'
        })
      }
    }

    return NextResponse.json({
      message: 'Backfill complete',
      ...results
    })
  } catch (error) {
    log.error('Error in backfill endpoint', { error })

    // Add to DLQ for retry
    await addToDLQ({
      operationType: 'batch_export',
      operationKey: `backfill:${new Date().toISOString()}`,
      errorMessage: error instanceof Error ? error.message : 'Backfill operation failed',
      errorStack: error instanceof Error ? error.stack : undefined,
      operationPayload: {
        timestamp: new Date().toISOString(),
      },
    }).catch((dlqError) => {
      log.error('Failed to add to DLQ', { error: dlqError })
    })

    return serverError('Internal server error')
  }
}
