/**
 * Email Ownership Reassignment Logic
 * Phase 1: PDR v3 Alignment - Email Ownership & Auto-Reassignment
 *
 * This module handles automatic reassignment of email ownership based on
 * workflow state transitions (e.g., when a proof is approved, reassign
 * emails from designer to salesperson).
 */

import { createClient } from '@/lib/supabase/client'

/**
 * Handle proof approval and reassign email ownership
 *
 * When a customer approves a proof:
 * 1. Get the current work item and find the designer (current assignee)
 * 2. Find the original salesperson (could be stored in work item metadata)
 * 3. Reassign all emails in the thread from designer to salesperson
 * 4. Update email status to indicate handoff is complete
 *
 * @param workItemId - The work item ID where proof was approved
 */
export async function handleProofApproval(workItemId: string) {
  const supabase = createClient()

  try {
    // 1. Get the work item details
    const { data: workItem, error: workItemError } = await supabase
      .from('work_items')
      .select('id, assigned_to_user_id, created_by_user_id, customer_id')
      .eq('id', workItemId)
      .single()

    if (workItemError || !workItem) {
      console.error('Failed to fetch work item:', workItemError)
      return { success: false, error: 'Work item not found' }
    }

    // 2. Determine the new owner (salesperson)
    // Logic: Use created_by_user_id as the original salesperson
    // If that's not available, keep current assignment
    const newOwnerId = workItem.created_by_user_id || workItem.assigned_to_user_id

    if (!newOwnerId) {
      console.error('No user to assign emails to')
      return { success: false, error: 'No assignee found' }
    }

    // 3. Reassign all communications for this work item to the salesperson
    const { data: updatedEmails, error: updateError } = await supabase
      .from('communications')
      .update({
        owner_user_id: newOwnerId,
        email_status: 'closed', // Mark as closed since proof is approved
      })
      .eq('work_item_id', workItemId)
      .select()

    if (updateError) {
      console.error('Failed to reassign emails:', updateError)
      return { success: false, error: 'Failed to reassign emails' }
    }

    // 4. Update work item to mark proof as approved
    const { error: approvalError } = await supabase
      .from('work_items')
      .update({
        proof_approved_at: new Date().toISOString(),
        design_review_status: 'approved',
      })
      .eq('id', workItemId)

    if (approvalError) {
      console.error('Failed to update work item:', approvalError)
      return { success: false, error: 'Failed to update work item' }
    }

    return {
      success: true,
      reassignedCount: updatedEmails?.length || 0,
      newOwnerId,
    }
  } catch (error) {
    console.error('Error in handleProofApproval:', error)
    return { success: false, error: 'Unexpected error' }
  }
}

/**
 * Reassign all emails in a thread to a new owner
 *
 * @param threadId - The email thread ID
 * @param newOwnerId - The user ID to reassign to
 */
export async function reassignEmailThread(threadId: string, newOwnerId: string) {
  const supabase = createClient()

  try {
    const { data: updatedEmails, error } = await supabase
      .from('communications')
      .update({ owner_user_id: newOwnerId })
      .eq('provider_thread_id', threadId)
      .select()

    if (error) {
      console.error('Failed to reassign thread:', error)
      return { success: false, error: 'Failed to reassign thread' }
    }

    return {
      success: true,
      reassignedCount: updatedEmails?.length || 0,
    }
  } catch (error) {
    console.error('Error in reassignEmailThread:', error)
    return { success: false, error: 'Unexpected error' }
  }
}

/**
 * Automatically assign email ownership based on work item assignment
 *
 * When a new email arrives and is linked to a work item,
 * automatically set the owner to the work item assignee.
 *
 * @param communicationId - The communication ID
 * @param workItemId - The work item ID
 */
export async function autoAssignEmailOwner(
  communicationId: string,
  workItemId: string
) {
  const supabase = createClient()

  try {
    // Get work item assignee
    const { data: workItem, error: workItemError } = await supabase
      .from('work_items')
      .select('assigned_to_user_id')
      .eq('id', workItemId)
      .single()

    if (workItemError || !workItem?.assigned_to_user_id) {
      return { success: false, error: 'No assignee found' }
    }

    // Update email owner
    const { error: updateError } = await supabase
      .from('communications')
      .update({ owner_user_id: workItem.assigned_to_user_id })
      .eq('id', communicationId)

    if (updateError) {
      console.error('Failed to auto-assign owner:', updateError)
      return { success: false, error: 'Failed to assign owner' }
    }

    return { success: true, ownerId: workItem.assigned_to_user_id }
  } catch (error) {
    console.error('Error in autoAssignEmailOwner:', error)
    return { success: false, error: 'Unexpected error' }
  }
}

/**
 * Bulk reassign emails from one user to another
 * Useful for workload balancing or when someone is out of office
 *
 * @param fromUserId - Current owner user ID
 * @param toUserId - New owner user ID
 * @param emailStatus - Optional: only reassign emails with this status
 */
export async function bulkReassignEmails(
  fromUserId: string,
  toUserId: string,
  emailStatus?: 'needs_reply' | 'waiting_on_customer' | 'closed'
) {
  const supabase = createClient()

  try {
    let query = supabase
      .from('communications')
      .update({ owner_user_id: toUserId })
      .eq('owner_user_id', fromUserId)

    if (emailStatus) {
      query = query.eq('email_status', emailStatus)
    }

    const { data: updatedEmails, error } = await query.select()

    if (error) {
      console.error('Failed to bulk reassign:', error)
      return { success: false, error: 'Failed to bulk reassign' }
    }

    return {
      success: true,
      reassignedCount: updatedEmails?.length || 0,
    }
  } catch (error) {
    console.error('Error in bulkReassignEmails:', error)
    return { success: false, error: 'Unexpected error' }
  }
}
