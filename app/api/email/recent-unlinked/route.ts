import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

export async function GET() {
  try {
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // Get recent emails from the last 7 days, any triage status
    const sevenDaysAgo = new Date()
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)

    const { data: emails, error } = await supabase
      .from('communications')
      .select('id, from_email, subject, body_preview, received_at, triage_status, work_item_id')
      .eq('direction', 'inbound')
      .gte('received_at', sevenDaysAgo.toISOString())
      .order('received_at', { ascending: false })
      .limit(50)

    if (error) throw error

    return NextResponse.json({ emails: emails || [] })
  } catch (error) {
    console.error('Recent emails error:', error)
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Failed to fetch emails',
      },
      { status: 500 }
    )
  }
}
