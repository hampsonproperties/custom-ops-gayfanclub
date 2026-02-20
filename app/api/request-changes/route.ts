import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import jwt from 'jsonwebtoken'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
const jwtSecret = process.env.JWT_SECRET!

interface TokenPayload {
  workItemId: string
  action: 'approve' | 'reject'
  exp: number
}

export async function POST(request: NextRequest) {
  try {
    const { token, feedback } = await request.json()

    if (!token || !feedback) {
      return NextResponse.json(
        { error: 'Missing required fields: token, feedback' },
        { status: 400 }
      )
    }

    // Verify and decode JWT token
    let payload: TokenPayload
    try {
      payload = jwt.verify(token, jwtSecret) as TokenPayload
    } catch (error) {
      if (error instanceof jwt.TokenExpiredError) {
        return NextResponse.json(
          { error: 'Token has expired' },
          { status: 401 }
        )
      }
      return NextResponse.json(
        { error: 'Invalid token' },
        { status: 401 }
      )
    }

    const { workItemId, action } = payload

    // Only allow reject tokens
    if (action !== 'reject') {
      return NextResponse.json(
        { error: 'Invalid token action' },
        { status: 400 }
      )
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // Check if token exists in database and hasn't been used
    const { data: tokenRecord, error: tokenError } = await supabase
      .from('approval_tokens')
      .select('*')
      .eq('token', token)
      .single()

    if (tokenError || !tokenRecord) {
      return NextResponse.json(
        { error: 'Token not found' },
        { status: 404 }
      )
    }

    if (tokenRecord.used_at) {
      return NextResponse.json(
        { error: 'Token has already been used' },
        { status: 400 }
      )
    }

    // Check if token is expired
    const now = new Date()
    const expiresAt = new Date(tokenRecord.expires_at)
    if (now > expiresAt) {
      return NextResponse.json(
        { error: 'Token has expired' },
        { status: 401 }
      )
    }

    // Fetch work item to get customer details
    const { data: workItem, error: workItemError } = await supabase
      .from('work_items')
      .select('type, status, customer_name, customer_email')
      .eq('id', workItemId)
      .single()

    if (workItemError || !workItem) {
      return NextResponse.json(
        { error: 'Work item not found' },
        { status: 404 }
      )
    }

    // Store feedback as a communication record
    const { error: commError } = await supabase
      .from('communications')
      .insert({
        work_item_id: workItemId,
        direction: 'inbound',
        from_email: workItem.customer_email || 'customer@unknown.com',
        to_emails: ['sales@thegayfanclub.com'],
        subject: `Design Changes Requested - ${workItem.customer_name || 'Customer'}`,
        body_html: `<p><strong>Customer Feedback:</strong></p><p>${feedback.replace(/\n/g, '<br>')}</p>`,
        body_preview: feedback.slice(0, 200),
        received_at: new Date().toISOString(),
        provider: 'web_form',
        triage_status: 'untriaged',
        category: 'order_related',
        is_read: false,
      })

    if (commError) {
      console.error('Failed to store feedback:', commError)
    }

    // Mark token as used
    await supabase
      .from('approval_tokens')
      .update({ used_at: new Date().toISOString() })
      .eq('id', tokenRecord.id)

    // Update work item status
    let newStatus = workItem.status

    if (workItem.type === 'customify_order') {
      newStatus = 'needs_customer_fix'
    } else if (workItem.type === 'assisted_project') {
      newStatus = 'in_design' // back to design phase
    }

    const { error: updateError } = await supabase
      .from('work_items')
      .update({
        approval_status: 'rejected',
        status: newStatus,
      })
      .eq('id', workItemId)

    if (updateError) {
      console.error('Failed to update work item:', updateError)
      return NextResponse.json(
        { error: 'Failed to update work item' },
        { status: 500 }
      )
    }

    // Recalculate next follow-up after status change
    try {
      const { data: nextFollowUp } = await supabase
        .rpc('calculate_next_follow_up', { work_item_id: workItemId })

      if (nextFollowUp !== undefined) {
        await supabase
          .from('work_items')
          .update({ next_follow_up_at: nextFollowUp })
          .eq('id', workItemId)
      }
    } catch (followUpError) {
      console.error('[Request Changes] Error calculating follow-up:', followUpError)
      // Don't fail the whole operation if follow-up calc fails
    }

    return NextResponse.json({
      success: true,
      workItemId,
      message: 'Changes request submitted successfully',
    })
  } catch (error) {
    console.error('Request changes error:', error)
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Failed to process request',
      },
      { status: 500 }
    )
  }
}
