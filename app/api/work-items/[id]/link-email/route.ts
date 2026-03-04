import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { validateBody, validateParams } from '@/lib/api/validate'
import { linkEmailBody, idParams } from '@/lib/api/schemas'
import { serverError } from '@/lib/api/errors'
import { logger } from '@/lib/logger'

const log = logger('work-items-link-email')


export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const paramResult = validateParams(await params, idParams)
    if (paramResult.error) return paramResult.error
    const { id } = paramResult.data

    const bodyResult = validateBody(await request.json(), linkEmailBody)
    if (bodyResult.error) return bodyResult.error
    const { emailId } = bodyResult.data

    const supabase = await createClient()

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
    log.error('Link email error', { error })
    return serverError(error instanceof Error ? error.message : 'Failed to link email')
  }
}

// GET endpoint to search for emails by customer email or triage status
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const supabase = await createClient()

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

    // Also check if there are emails already linked to this work item
    const { data: alreadyLinked } = await supabase
      .from('communications')
      .select('*')
      .eq('work_item_id', id)
      .order('received_at', { ascending: false })

    return NextResponse.json({
      emails: uniqueEmails,
      alreadyLinked: alreadyLinked || [],
      debug: {
        workItemCreatedAt: workItem.created_at,
        timeBefore: timeBefore.toISOString(),
        timeAfter: timeAfter.toISOString(),
        recentTriagedCount: recentTriaged?.length || 0,
        customerEmailCount: workItem.customer_email ? 'searched' : 'no customer email'
      }
    })
  } catch (error) {
    log.error('Search emails error', { error })
    return serverError(error instanceof Error ? error.message : 'Failed to search emails')
  }
}
