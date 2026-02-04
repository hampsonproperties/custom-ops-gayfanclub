import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const { emailId } = await request.json()

    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // Link the email to the work item
    const { error } = await supabase
      .from('communications')
      .update({
        work_item_id: id,
        triage_status: 'attached',
      })
      .eq('id', emailId)

    if (error) throw error

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Link email error:', error)
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Failed to link email',
      },
      { status: 500 }
    )
  }
}

// GET endpoint to search for emails by customer email
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // Get the work item to find customer email
    const { data: workItem } = await supabase
      .from('work_items')
      .select('customer_email')
      .eq('id', id)
      .single()

    if (!workItem?.customer_email) {
      return NextResponse.json({ emails: [] })
    }

    // Find emails from or to this customer email that aren't linked yet
    const { data: emails } = await supabase
      .from('communications')
      .select('*')
      .or(`from_email.eq.${workItem.customer_email},to_emails.cs.{${workItem.customer_email}}`)
      .is('work_item_id', null)
      .order('received_at', { ascending: false })
      .limit(20)

    return NextResponse.json({ emails: emails || [] })
  } catch (error) {
    console.error('Search emails error:', error)
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Failed to search emails',
      },
      { status: 500 }
    )
  }
}
