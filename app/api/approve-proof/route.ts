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

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const token = searchParams.get('token')

    if (!token) {
      return NextResponse.json(
        { error: 'Missing token parameter' },
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

    // Mark token as used
    await supabase
      .from('approval_tokens')
      .update({ used_at: new Date().toISOString() })
      .eq('id', tokenRecord.id)

    // Fetch work item to determine type
    const { data: workItem, error: workItemError } = await supabase
      .from('work_items')
      .select('type, status')
      .eq('id', workItemId)
      .single()

    if (workItemError || !workItem) {
      return NextResponse.json(
        { error: 'Work item not found' },
        { status: 404 }
      )
    }

    // Update work item approval status and status
    const approvalStatus = action === 'approve' ? 'approved' : 'rejected'
    let newStatus = workItem.status

    // Update status based on type and action
    if (action === 'approve') {
      if (workItem.type === 'customify_order') {
        newStatus = 'approved'
      } else if (workItem.type === 'assisted_project') {
        newStatus = 'invoice_sent' // or another appropriate status
      }
    } else if (action === 'reject') {
      if (workItem.type === 'customify_order') {
        newStatus = 'needs_customer_fix'
      } else if (workItem.type === 'assisted_project') {
        newStatus = 'in_design' // back to design phase
      }
    }

    const { error: updateError } = await supabase
      .from('work_items')
      .update({
        approval_status: approvalStatus,
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
      console.error('[Approve Proof] Error calculating follow-up:', followUpError)
      // Don't fail the whole operation if follow-up calc fails
    }

    // Redirect to confirmation page with action and work item ID
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
    return NextResponse.redirect(
      `${baseUrl}/approve-proof?success=true&action=${action}&workItemId=${workItemId}`
    )
  } catch (error) {
    console.error('Approve proof error:', error)
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Failed to process approval',
      },
      { status: 500 }
    )
  }
}
