import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { nanoid } from 'nanoid'
import { z } from 'zod'
import { MAX_FILE_SIZE, ALLOWED_MIME_TYPES } from '@/lib/api/schemas'
import { unauthorized, badRequest, serverError } from '@/lib/api/errors'
import { logger } from '@/lib/logger'

const log = logger('api-files-upload')

// Sanitize filename: remove path separators and special characters
function sanitizeFilename(filename: string): string {
  return filename
    .replace(/[/\\]/g, '_')           // Remove path separators
    .replace(/\.\./g, '_')            // Remove directory traversal
    .replace(/[^\w\s.\-()]/g, '_')    // Only allow safe characters
    .replace(/\s+/g, '_')             // Replace spaces with underscores
    .slice(0, 200)                     // Limit length
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()

    // Check authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return unauthorized('Unauthorized')
    }

    // Parse form data
    const formData = await request.formData()
    const file = formData.get('file') as File
    const projectId = formData.get('projectId') as string
    const customerId = formData.get('customerId') as string

    if (!file) {
      return badRequest('No file provided')
    }

    // Validate projectId and customerId are UUIDs
    const uuidSchema = z.string().uuid()
    const projectIdResult = uuidSchema.safeParse(projectId)
    const customerIdResult = uuidSchema.safeParse(customerId)

    if (!projectIdResult.success || !customerIdResult.success) {
      return badRequest('Invalid projectId or customerId')
    }

    // Validate file size (10MB limit)
    if (file.size > MAX_FILE_SIZE) {
      return badRequest(`File too large. Maximum size is ${MAX_FILE_SIZE / 1024 / 1024}MB`)
    }

    // Validate file type
    const allowedTypes: readonly string[] = ALLOWED_MIME_TYPES
    if (!allowedTypes.includes(file.type)) {
      return badRequest(`File type "${file.type}" is not allowed. Accepted types: images, PDF, AI, PSD, ZIP`)
    }

    // Sanitize filename and generate unique path
    const safeOriginalName = sanitizeFilename(file.name)
    const fileExt = safeOriginalName.split('.').pop() || 'bin'
    const fileName = `${nanoid()}.${fileExt}`
    const filePath = `${customerId}/${projectId}/${fileName}`

    // Convert file to ArrayBuffer
    const arrayBuffer = await file.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)

    // Upload to Supabase Storage
    const { data: storageData, error: storageError } = await supabase.storage
      .from('files')
      .upload(filePath, buffer, {
        contentType: file.type,
        upsert: false
      })

    if (storageError) {
      log.error('Storage upload error', { error: storageError })
      return serverError('Failed to upload file to storage')
    }

    // Get public URL
    const { data: { publicUrl } } = supabase.storage
      .from('files')
      .getPublicUrl(filePath)

    // Create file record in database (write all columns for consistency with hook upload path)
    const { data: fileRecord, error: dbError } = await supabase
      .from('files')
      .insert({
        work_item_id: projectId,
        customer_id: customerId,
        filename: safeOriginalName,
        original_filename: file.name,
        normalized_filename: safeOriginalName,
        file_path: filePath,
        external_url: publicUrl,
        storage_bucket: 'files',
        storage_path: filePath,
        mime_type: file.type,
        file_size_bytes: file.size,
        size_bytes: file.size,
        kind: 'design_file',
        uploaded_by_user_id: user.id
      })
      .select()
      .single()

    if (dbError) {
      log.error('Database insert error', { error: dbError })
      // Clean up uploaded file
      await supabase.storage.from('files').remove([filePath])
      return serverError('Failed to create file record')
    }

    // Create activity log entry
    await supabase
      .from('activity_logs')
      .insert({
        activity_type: 'file_uploaded',
        related_entity_type: 'work_item',
        related_entity_id: projectId,
        customer_id: customerId,
        user_id: user.id,
        metadata: {
          file_id: fileRecord.id,
          filename: safeOriginalName,
          file_size: file.size
        }
      })

    return NextResponse.json({
      success: true,
      file: fileRecord
    })

  } catch (error: any) {
    log.error('Upload error', { error })
    return serverError(error.message || 'Internal server error')
  }
}
