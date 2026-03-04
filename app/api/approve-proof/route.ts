import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import jwt from 'jsonwebtoken'
import { badRequest, unauthorized, notFound, serverError } from '@/lib/api/errors'
import { logger } from '@/lib/logger'

const log = logger('approve-proof')

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
      return badRequest('Missing token parameter')
    }

    // Verify and decode JWT token
    let payload: TokenPayload
    try {
      payload = jwt.verify(token, jwtSecret) as TokenPayload
    } catch (error) {
      if (error instanceof jwt.TokenExpiredError) {
        return unauthorized('Token has expired')
      }
      return unauthorized('Invalid token')
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
      return notFound('Token not found')
    }

    if (tokenRecord.used_at) {
      return badRequest('Token has already been used')
    }

    // Check if token is expired
    const now = new Date()
    const expiresAt = new Date(tokenRecord.expires_at)
    if (now > expiresAt) {
      return unauthorized('Token has expired')
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
      return notFound('Work item not found')
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
      log.error('Failed to update work item', { error: updateError, workItemId })
      return serverError('Failed to update work item')
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
      log.error('Error calculating follow-up', { error: followUpError, workItemId })
      // Don't fail the whole operation if follow-up calc fails
    }

    // Redirect to confirmation page with action and work item ID
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
    return NextResponse.redirect(
      `${baseUrl}/approve-proof?success=true&action=${action}&workItemId=${workItemId}`
    )
  } catch (error) {
    log.error('Approve proof error', { error })
    return serverError(error instanceof Error ? error.message : 'Failed to process approval')
  }
}
