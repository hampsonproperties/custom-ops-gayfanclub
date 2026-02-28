import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const supabase = await createClient()

    // Check authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get file record from database
    const { data: file, error: fileError } = await supabase
      .from('files')
      .select('*')
      .eq('id', id)
      .single()

    if (fileError || !file) {
      return NextResponse.json({ error: 'File not found' }, { status: 404 })
    }

    // Generate signed URL (valid for 1 hour)
    const { data: signedData, error: signError } = await supabase.storage
      .from('files')
      .createSignedUrl(file.file_path, 3600)

    if (signError || !signedData) {
      console.error('Error generating signed URL:', signError)
      return NextResponse.json({ error: 'Failed to generate download URL' }, { status: 500 })
    }

    return NextResponse.json({
      url: signedData.signedUrl,
      filename: file.filename
    })

  } catch (error: any) {
    console.error('Download error:', error)
    return NextResponse.json({
      error: error.message || 'Internal server error'
    }, { status: 500 })
  }
}
