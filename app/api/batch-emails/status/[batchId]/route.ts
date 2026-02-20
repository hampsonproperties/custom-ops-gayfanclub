import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

export async function GET(request: NextRequest, { params }: { params: Promise<{ batchId: string }> }) {
  try {
    const { batchId } = await params

    if (!batchId) {
      return NextResponse.json({ error: 'Missing batchId' }, { status: 400 })
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // Call the database function to get batch email status
    const { data, error } = await supabase.rpc('get_batch_email_status', { p_batch_id: batchId })

    if (error) {
      console.error('Failed to get batch email status:', error)
      return NextResponse.json({ error: 'Failed to fetch batch email status' }, { status: 500 })
    }

    return NextResponse.json({
      batchId,
      emails: data || [],
    })
  } catch (error) {
    console.error('Get batch email status error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to get batch email status' },
      { status: 500 }
    )
  }
}
