/**
 * Re-link Unlinked Emails
 * Finds communications with NULL customer_id and matches them
 * to existing customers by email address.
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { requireAuth } from '@/lib/api/require-auth'
import { logger } from '@/lib/logger'
import { serverError } from '@/lib/api/errors'

const log = logger('data-health-relink-emails')

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

export async function POST(request: NextRequest) {
  try {
    const auth = await requireAuth()
    if (auth.response) return auth.response

    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    log.info('Starting email re-linking', { userId: auth.user.id })

    // Build a lookup map of email → customer_id for all customers with email
    const { data: customers, error: custError } = await supabase
      .from('customers')
      .select('id, email')
      .not('email', 'is', null)
      .neq('email', '')

    if (custError) {
      log.error('Failed to fetch customers', { error: custError })
      return serverError('Failed to fetch customer list')
    }

    const emailToCustomer = new Map<string, string>()
    for (const c of customers || []) {
      if (c.email) {
        emailToCustomer.set(c.email.toLowerCase(), c.id)
      }
    }

    // Fetch unlinked communications in batches
    const { data: unlinked, error: fetchError } = await supabase
      .from('communications')
      .select('id, from_email, to_emails, direction')
      .is('customer_id', null)
      .limit(1000)

    if (fetchError) {
      log.error('Failed to fetch unlinked communications', { error: fetchError })
      return serverError('Failed to fetch unlinked communications')
    }

    if (!unlinked || unlinked.length === 0) {
      return NextResponse.json({ success: true, linked: 0, total_unlinked: 0 })
    }

    log.info('Found unlinked communications', { count: unlinked.length })

    let linked = 0
    const errors: string[] = []

    for (const comm of unlinked) {
      try {
        let customerId: string | null = null

        // For inbound emails: match from_email to customer
        if (comm.direction === 'inbound' && comm.from_email) {
          customerId = emailToCustomer.get(comm.from_email.toLowerCase()) || null
        }

        // For outbound emails: match first to_email to customer
        if (comm.direction === 'outbound' && comm.to_emails && Array.isArray(comm.to_emails) && comm.to_emails.length > 0) {
          for (const toEmail of comm.to_emails) {
            customerId = emailToCustomer.get(toEmail.toLowerCase()) || null
            if (customerId) break
          }
        }

        // Fallback: try from_email for outbound too (some outbound have customer in from_email due to reply chains)
        if (!customerId && comm.from_email) {
          customerId = emailToCustomer.get(comm.from_email.toLowerCase()) || null
        }

        // Last resort: try to_emails for inbound
        if (!customerId && comm.to_emails && Array.isArray(comm.to_emails)) {
          for (const toEmail of comm.to_emails) {
            customerId = emailToCustomer.get(toEmail.toLowerCase()) || null
            if (customerId) break
          }
        }

        if (customerId) {
          const { error: updateError } = await supabase
            .from('communications')
            .update({ customer_id: customerId })
            .eq('id', comm.id)

          if (updateError) {
            errors.push(`Comm ${comm.id}: ${updateError.message}`)
          } else {
            linked++
          }
        }
      } catch (err: any) {
        errors.push(`Comm ${comm.id}: ${err.message}`)
      }
    }

    log.info('Email re-linking complete', { linked, total: unlinked.length, errorCount: errors.length })

    return NextResponse.json({
      success: true,
      linked,
      total_unlinked: unlinked.length,
      errors: errors.length > 0 ? errors : undefined,
    })
  } catch (error: any) {
    log.error('Email re-linking error', { error })
    return serverError('An error occurred during email re-linking')
  }
}
