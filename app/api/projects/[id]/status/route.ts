import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { validateBody, validateParams } from '@/lib/api/validate'
import { updateStatusBody, idParams } from '@/lib/api/schemas'
import { badRequest, unauthorized, notFound, serverError } from '@/lib/api/errors'
import { analyzeTransition } from '@/lib/utils/status-transitions'
import { WorkItemStatus, WorkItemType } from '@/types/database'
import { logger } from '@/lib/logger'

const log = logger('projects-status')

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const paramResult = validateParams(await params, idParams)
    if (paramResult.error) return paramResult.error
    const { id: projectId } = paramResult.data

    const supabase = await createClient()

    // Check authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return unauthorized('Unauthorized')
    }

    // Parse and validate request body
    const bodyResult = validateBody(await request.json(), updateStatusBody)
    if (bodyResult.error) return bodyResult.error
    const { status, note } = bodyResult.data

    // Fetch current work item to validate the transition
    const { data: workItem, error: fetchError } = await supabase
      .from('work_items')
      .select('status, type')
      .eq('id', projectId)
      .single()

    if (fetchError || !workItem) {
      return notFound('Project not found')
    }

    // Validate status transition using the same rules as the frontend
    const transition = analyzeTransition(
      workItem.status as WorkItemStatus,
      status as WorkItemStatus,
      workItem.type as WorkItemType
    )

    if (transition.isBlocked) {
      return badRequest(transition.blockReason || 'This status transition is not allowed')
    }

    if (transition.requiresNotes && !note) {
      return badRequest('A note is required for this status change')
    }

    // Atomic status change: updates work_items.status + creates work_item_status_events audit trail
    // Uses FOR UPDATE row locking to prevent concurrent status changes on the same work item
    const { data, error: rpcError } = await supabase
      .rpc('change_work_item_status', {
        p_work_item_id: projectId,
        p_new_status: status,
        p_changed_by_user_id: user.id,
        p_note: note || null,
      })

    if (rpcError) {
      // RPC raises exception if work item not found
      if (rpcError.message?.includes('Work item not found')) {
        return notFound('Project not found')
      }
      log.error('Error updating project status', { error: rpcError })
      return serverError('Failed to update status')
    }

    return NextResponse.json({
      success: true,
      status
    })

  } catch (error: any) {
    log.error('Status update error', { error })
    return serverError(error.message || 'Internal server error')
  }
}
