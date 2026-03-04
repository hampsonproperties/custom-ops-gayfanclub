import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { badRequest, serverError } from '@/lib/api/errors'
import { logger } from '@/lib/logger'

const log = logger('batch-email-status')


export async function GET(request: NextRequest, { params }: { params: Promise<{ batchId: string }> }) {
  try {
    const { batchId } = await params

    if (!batchId) {
      return badRequest('Missing batchId')
    }

    const supabase = await createClient()

    // Call the database function to get batch email status
    const { data, error } = await supabase.rpc('get_batch_email_status', { p_batch_id: batchId })

    if (error) {
      log.error('Failed to get batch email status', { error })
      return serverError('Failed to fetch batch email status')
    }

    return NextResponse.json({
      batchId,
      emails: data || [],
    })
  } catch (error) {
    log.error('Get batch email status error', { error })
    return serverError(error instanceof Error ? error.message : 'Failed to get batch email status')
  }
}
