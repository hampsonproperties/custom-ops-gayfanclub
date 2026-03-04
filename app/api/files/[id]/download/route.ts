import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { unauthorized, notFound, serverError } from '@/lib/api/errors'
import { logger } from '@/lib/logger'

const log = logger('api-files-download')

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
      return unauthorized('Unauthorized')
    }

    // Get file record from database
    const { data: file, error: fileError } = await supabase
      .from('files')
      .select('*')
      .eq('id', id)
      .single()

    if (fileError || !file) {
      return notFound('File not found')
    }

    // Generate signed URL (valid for 1 hour)
    const { data: signedData, error: signError } = await supabase.storage
      .from('files')
      .createSignedUrl(file.file_path, 3600)

    if (signError || !signedData) {
      log.error('Error generating signed URL', { error: signError })
      return serverError('Failed to generate download URL')
    }

    return NextResponse.json({
      url: signedData.signedUrl,
      filename: file.filename
    })

  } catch (error: any) {
    log.error('Download error', { error })
    return serverError(error.message || 'Internal server error')
  }
}
