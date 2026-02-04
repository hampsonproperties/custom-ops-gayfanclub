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

// GET endpoint to search for emails by customer email or triage status
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // Get the work item to find customer email and creation time
    const { data: workItem } = await supabase
      .from('work_items')
      .select('customer_email, created_at')
      .eq('id', id)
      .single()

    if (!workItem) {
      return NextResponse.json({ emails: [] })
    }

    const allEmails: any[] = []

    // Strategy 1: Find emails that were marked as 'created_lead' but work_item_id is null or wrong
    // (This handles the case where the link failed during lead creation)
    const createdAt = new Date(workItem.created_at)
    const timeBefore = new Date(createdAt.getTime() - 5 * 60 * 1000) // 5 minutes before
    const timeAfter = new Date(createdAt.getTime() + 5 * 60 * 1000) // 5 minutes after

    const { data: recentTriaged } = await supabase
      .from('communications')
      .select('*')
      .eq('triage_status', 'created_lead')
      .or(`work_item_id.is.null,work_item_id.neq.${id}`)
      .gte('received_at', timeBefore.toISOString())
      .lte('received_at', timeAfter.toISOString())
      .order('received_at', { ascending: false })

    if (recentTriaged && recentTriaged.length > 0) {
      allEmails.push(...recentTriaged)
    }

    // Strategy 2: Find emails from or to this customer email that aren't linked yet
    if (workItem.customer_email) {
      const { data: customerEmails } = await supabase
        .from('communications')
        .select('*')
        .or(`from_email.eq.${workItem.customer_email},to_emails.cs.{${workItem.customer_email}}`)
        .is('work_item_id', null)
        .order('received_at', { ascending: false })
        .limit(20)

      if (customerEmails && customerEmails.length > 0) {
        allEmails.push(...customerEmails)
      }
    }

    // Remove duplicates by email id
    const uniqueEmails = Array.from(
      new Map(allEmails.map(email => [email.id, email])).values()
    )

    return NextResponse.json({ emails: uniqueEmails })
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
