import { NextRequest, NextResponse } from 'next/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/server'
import jwt from 'jsonwebtoken'
import { validateBody } from '@/lib/api/validate'
import { requestChangesBody } from '@/lib/api/schemas'
import { badRequest, unauthorized, notFound, serverError } from '@/lib/api/errors'
import { logger } from '@/lib/logger'

const log = logger('request-changes')

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
const jwtSecret = process.env.JWT_SECRET!

// Escape HTML to prevent XSS when inserting user text into body_html
function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
}

interface TokenPayload {
  workItemId: string
  action: 'approve' | 'reject'
  exp: number
}

export async function POST(request: NextRequest) {
  try {
    const authClient = await createClient()
    const { data: { user } } = await authClient.auth.getUser()
    if (!user) return unauthorized()

    const bodyResult = validateBody(await request.json(), requestChangesBody)
    if (bodyResult.error) return bodyResult.error
    const { token, feedback } = bodyResult.data

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

    // Only allow reject tokens
    if (action !== 'reject') {
      return badRequest('Invalid token action')
    }

    const supabase = createServiceClient(supabaseUrl, supabaseServiceKey)

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

    // Fetch work item to get customer details
    const { data: workItem, error: workItemError } = await supabase
      .from('work_items')
      .select('type, status, customer_name, customer_email')
      .eq('id', workItemId)
      .single()

    if (workItemError || !workItem) {
      return notFound('Work item not found')
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
        body_html: `<p><strong>Customer Feedback:</strong></p><p>${escapeHtml(feedback).replace(/\n/g, '<br>')}</p>`,
        body_preview: feedback.slice(0, 200),
        received_at: new Date().toISOString(),
        provider: 'web_form',
        triage_status: 'untriaged',
        category: 'order_related',
        is_read: false,
      })

    if (commError) {
      log.error('Failed to store feedback', { error: commError, workItemId })
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

    return NextResponse.json({
      success: true,
      workItemId,
      message: 'Changes request submitted successfully',
    })
  } catch (error) {
    log.error('Request changes error', { error })
    return serverError(error instanceof Error ? error.message : 'Failed to process request')
  }
}
