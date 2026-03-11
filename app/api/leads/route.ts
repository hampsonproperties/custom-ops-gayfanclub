import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { requireAuth } from '@/lib/api/require-auth'
import { badRequest, serverError } from '@/lib/api/errors'
import { findOrCreateCustomerByEmail } from '@/lib/utils/find-or-create-customer'
import { logger } from '@/lib/logger'

const log = logger('api-leads')

/**
 * POST /api/leads
 *
 * Creates a new lead (work item) from an email, with proper customer linkage
 * and audit trail (created_by_user_id).
 *
 * This is used by the Inbox and Support Queue "Create Lead" buttons.
 * Unlike the generic useCreateWorkItem hook (which inserts directly),
 * this route:
 *   1. Authenticates the user (so we know WHO created the lead)
 *   2. Finds or creates a customer record (so the lead is linked to CRM)
 *   3. Sets both customer_id and created_by_user_id on the work item
 */
export async function POST(request: NextRequest) {
  try {
    const auth = await requireAuth()
    if (auth.response) return auth.response

    const body = await request.json()

    // Validate required fields
    if (!body.customer_email) {
      return badRequest('Customer email is required')
    }
    if (!body.source) {
      return badRequest('Source is required')
    }

    const supabase = await createClient()

    // Find or create customer record
    const customerId = await findOrCreateCustomerByEmail(
      supabase,
      body.customer_email,
      body.customer_name
    )

    log.info('Creating lead', {
      userId: auth.user.id,
      customerEmail: body.customer_email,
      customerId,
      source: body.source,
    })

    // Insert work item with customer linkage and audit trail
    // Customer data (name, email, company) lives on the customer record — not duplicated here
    const { data, error } = await supabase
      .from('work_items')
      .insert({
        type: body.type || 'assisted_project',
        source: body.source,
        status: body.status || 'new_inquiry',
        customer_id: customerId,
        created_by_user_id: auth.user.id,
        title: body.title,
        event_date: body.event_date || null,
        last_contact_at: body.last_contact_at || new Date().toISOString(),
        next_follow_up_at: body.next_follow_up_at || null,
      })
      .select()
      .single()

    if (error) {
      log.error('Failed to create lead', { error })
      return serverError(error.message)
    }

    // Calculate initial follow-up date if not provided
    if (!body.next_follow_up_at && data?.id) {
      try {
        const { data: nextFollowUp } = await supabase
          .rpc('calculate_next_follow_up', { work_item_id: data.id })

        if (nextFollowUp !== undefined) {
          await supabase
            .from('work_items')
            .update({ next_follow_up_at: nextFollowUp })
            .eq('id', data.id)
        }
      } catch (followUpError) {
        // Non-fatal: lead is created, follow-up calc failed
        log.error('Error calculating follow-up', { error: followUpError })
      }
    }

    log.info('Lead created successfully', {
      workItemId: data.id,
      customerId,
      createdBy: auth.user.email,
    })

    return NextResponse.json({ data })
  } catch (error) {
    log.error('Unexpected error creating lead', { error })
    return serverError(error instanceof Error ? error.message : 'Failed to create lead')
  }
}
