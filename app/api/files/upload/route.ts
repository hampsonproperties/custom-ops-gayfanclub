import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { nanoid } from 'nanoid'

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()

    // Check authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Parse form data
    const formData = await request.formData()
    const file = formData.get('file') as File
    const projectId = formData.get('projectId') as string
    const customerId = formData.get('customerId') as string

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 })
    }

    if (!projectId || !customerId) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    // Generate unique filename
    const fileExt = file.name.split('.').pop()
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
      console.error('Storage upload error:', storageError)
      return NextResponse.json({ error: 'Failed to upload file to storage' }, { status: 500 })
    }

    // Get public URL
    const { data: { publicUrl } } = supabase.storage
      .from('files')
      .getPublicUrl(filePath)

    // Create file record in database
    const { data: fileRecord, error: dbError } = await supabase
      .from('files')
      .insert({
        work_item_id: projectId,
        customer_id: customerId,
        filename: file.name,
        file_path: filePath,
        external_url: publicUrl,
        mime_type: file.type,
        file_size_bytes: file.size,
        kind: 'design_file', // Default kind, can be updated later
        uploaded_by_user_id: user.id
      })
      .select()
      .single()

    if (dbError) {
      console.error('Database insert error:', dbError)
      // Clean up uploaded file
      await supabase.storage.from('files').remove([filePath])
      return NextResponse.json({ error: 'Failed to create file record' }, { status: 500 })
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
          filename: file.name,
          file_size: file.size
        }
      })

    return NextResponse.json({
      success: true,
      file: fileRecord
    })

  } catch (error: any) {
    console.error('Upload error:', error)
    return NextResponse.json({
      error: error.message || 'Internal server error'
    }, { status: 500 })
  }
}
