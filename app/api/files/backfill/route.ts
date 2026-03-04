import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { logger } from '@/lib/logger'

const log = logger('api-files-backfill')

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

/**
 * Downloads a file from an external URL and uploads it to Supabase Storage
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
      log.error('Failed to download file', { status: response.status, statusText: response.statusText })
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
      log.error('Failed to upload file to Supabase Storage', { error: uploadError })
      return null
    }

    log.info('Successfully stored file', { storagePath, sizeBytes })
    return { path: storagePath, sizeBytes }
  } catch (error) {
    log.error('Error downloading/storing file', { error })
    return null
  }
}

/**
 * Backfill endpoint to download existing Customify files and store in Supabase
 * POST /api/files/backfill
 */
export async function POST(request: NextRequest) {
  const supabase = createClient(supabaseUrl, supabaseServiceKey)

  try {
    // Get all files that are stored externally (storage_bucket = 'customify')
    const { data: externalFiles, error: fetchError } = await supabase
      .from('files')
      .select('*')
      .eq('storage_bucket', 'customify')
      .order('created_at', { ascending: true })

    if (fetchError) {
      throw fetchError
    }

    if (!externalFiles || externalFiles.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No external files to backfill',
        total: 0,
        succeeded: 0,
        failed: 0,
        details: [],
      })
    }

    log.info('Found external files to backfill', { count: externalFiles.length })

    const results = {
      total: externalFiles.length,
      succeeded: 0,
      failed: 0,
      details: [] as Array<{ id: string; filename: string; status: string; error?: string }>,
    }

    // Process each file
    for (const file of externalFiles) {
      try {
        log.info('Processing file', { fileId: file.id, filename: file.original_filename })

        // Download and store the file
        const storedFile = await downloadAndStoreFile(
          supabase,
          file.storage_path,
          file.work_item_id,
          file.original_filename
        )

        if (storedFile) {
          // Update the file record to point to our storage
          const { error: updateError } = await supabase
            .from('files')
            .update({
              storage_bucket: 'custom-ops-files',
              storage_path: storedFile.path,
              external_url: file.storage_path, // Preserve original URL
              size_bytes: storedFile.sizeBytes,
              note: (file.note || '') + ' [Backfilled to Supabase Storage]',
              updated_at: new Date().toISOString(),
            })
            .eq('id', file.id)

          if (updateError) {
            throw updateError
          }

          results.succeeded++
          results.details.push({
            id: file.id,
            filename: file.original_filename,
            status: 'success',
          })
          log.info('Successfully backfilled file', { filename: file.original_filename })
        } else {
          results.failed++
          results.details.push({
            id: file.id,
            filename: file.original_filename,
            status: 'failed',
            error: 'Download or upload failed',
          })
          log.error('Failed to backfill file', { filename: file.original_filename })
        }
      } catch (error) {
        results.failed++
        results.details.push({
          id: file.id,
          filename: file.original_filename,
          status: 'failed',
          error: error instanceof Error ? error.message : 'Unknown error',
        })
        log.error('Error processing file', { filename: file.original_filename, error })
      }
    }

    return NextResponse.json({
      success: true,
      message: `Backfill complete: ${results.succeeded} succeeded, ${results.failed} failed`,
      ...results,
    })
  } catch (error) {
    log.error('Backfill error', { error })
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Backfill failed',
      },
      { status: 500 }
    )
  }
}
