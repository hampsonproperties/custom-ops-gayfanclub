import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

export async function GET(request: NextRequest) {
  try {
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // Get work item ID and customer email from query params
    const { searchParams } = new URL(request.url)
    const workItemId = searchParams.get('workItemId')
    const customerEmail = searchParams.get('customerEmail')

    if (!workItemId || !customerEmail) {
      return NextResponse.json({ emails: [] })
    }

    // Only get emails from or mentioning this specific customer
    const sevenDaysAgo = new Date()
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)

    const { data: emails, error } = await supabase
      .from('communications')
      .select('id, from_email, subject, body_preview, received_at, triage_status, work_item_id')
      .eq('direction', 'inbound')
      .or(`from_email.eq.${customerEmail},body_preview.ilike.%${customerEmail}%,subject.ilike.%${customerEmail}%`)
      .gte('received_at', sevenDaysAgo.toISOString())
      .order('received_at', { ascending: false })
      .limit(20)

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
