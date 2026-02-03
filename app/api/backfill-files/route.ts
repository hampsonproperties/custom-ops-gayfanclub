import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

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

    console.log(`Downloading file from: ${url}`)

    // Download file from external URL
    const response = await fetch(url)
    if (!response.ok) {
      console.error(`Failed to download file: ${response.status} ${response.statusText}`)
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
      console.error(`Failed to upload file to Supabase Storage:`, uploadError)
      return null
    }

    console.log(`Successfully stored file at: ${storagePath} (${sizeBytes} bytes)`)
    return { path: storagePath, sizeBytes }
  } catch (error) {
    console.error(`Error downloading/storing file:`, error)
    return null
  }
}

export async function POST(request: Request) {
  try {
    const supabase = await createClient()

    // Get all files that are stored in 'customify' bucket (external URLs)
    const { data: customifyFiles, error: filesError } = await supabase
      .from('files')
      .select('id, work_item_id, storage_path, original_filename, kind, version, external_url')
      .eq('storage_bucket', 'customify')
      .order('created_at', { ascending: true })

    if (filesError) {
      console.error('Error fetching Customify files:', filesError)
      return NextResponse.json({ error: 'Failed to fetch files' }, { status: 500 })
    }

    if (!customifyFiles || customifyFiles.length === 0) {
      return NextResponse.json({
        message: 'No Customify files found to backfill',
        processed: 0,
        successful: 0,
        failed: 0
      })
    }

    console.log(`Found ${customifyFiles.length} Customify files to backfill`)

    const results = {
      total: customifyFiles.length,
      successful: 0,
      failed: 0,
      errors: [] as any[]
    }

    // Process each file
    for (const file of customifyFiles) {
      try {
        // Use external_url if available, otherwise fall back to storage_path
        const externalUrl = file.external_url || file.storage_path

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
              external_url: externalUrl, // Preserve original URL
              size_bytes: storedFile.sizeBytes,
              note: 'Backfilled from Customify to Supabase Storage'
            })
            .eq('id', file.id)

          if (updateError) {
            console.error(`Failed to update file record ${file.id}:`, updateError)
            results.failed++
            results.errors.push({ fileId: file.id, error: updateError.message })
          } else {
            results.successful++
            console.log(`✓ Backfilled file ${file.id}`)
          }
        } else {
          results.failed++
          results.errors.push({
            fileId: file.id,
            error: 'Failed to download file from external URL'
          })
        }
      } catch (error) {
        console.error(`Error processing file ${file.id}:`, error)
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
    console.error('Error in backfill endpoint:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
