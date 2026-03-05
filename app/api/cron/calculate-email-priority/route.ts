import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'
import { unauthorized, serverError } from '@/lib/api/errors'
import { logger } from '@/lib/logger'
import { sendNotificationEmail } from '@/lib/utils/send-notification-email'

const log = logger('cron-email-priority')

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

/**
 * Hourly cron job to calculate email priority based on response time
 * Phase 1: PDR v3 Alignment - Auto-Reminder System
 *
 * Priority Rules:
 * - HIGH: Customer replied and >24h no response from us, OR inbound email >48h old
 * - MEDIUM: Sent email waiting for customer response >48h, OR inbound email >24h old
 * - LOW: Recent emails (<24h)
 *
 * Security: Requires CRON_SECRET authorization header
 */
export async function GET(request: Request) {
  try {
    // Verify authorization
    const authHeader = request.headers.get('authorization')
    const cronSecret = process.env.CRON_SECRET

    if (!cronSecret) {
      log.error('CRON_SECRET not configured')
      return serverError('Cron secret not configured')
    }

    if (authHeader !== `Bearer ${cronSecret}`) {
      log.error('Unauthorized cron request')
      return unauthorized('Unauthorized')
    }

    // Use service role key for cron job
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    const now = new Date()
    const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000)
    const fortyEightHoursAgo = new Date(now.getTime() - 48 * 60 * 60 * 1000)

    let totalUpdated = 0

    // ========================================================================
    // RULE 1: Set HIGH priority for inbound emails >48h old that need reply
    // ========================================================================
    const { data: highPriorityInbound, error: error1 } = await supabase
      .from('communications')
      .update({
        priority: 'high',
      })
      .eq('direction', 'inbound')
      .eq('email_status', 'needs_reply')
      .lt('received_at', fortyEightHoursAgo.toISOString())
      .neq('priority', 'high') // Only update if not already high
      .select('id')

    if (error1) {
      log.error('Error updating high priority inbound', { error: error1 })
    } else {
      totalUpdated += highPriorityInbound?.length || 0
      log.info('Set inbound emails to HIGH priority (>48h old)', { count: highPriorityInbound?.length || 0 })
    }

    // ========================================================================
    // RULE 2: Set HIGH priority for inbound emails >24h old that need reply
    // ========================================================================
    const { data: mediumHighInbound, error: error2 } = await supabase
      .from('communications')
      .update({
        priority: 'high',
      })
      .eq('direction', 'inbound')
      .eq('email_status', 'needs_reply')
      .lt('received_at', twentyFourHoursAgo.toISOString())
      .gte('received_at', fortyEightHoursAgo.toISOString())
      .neq('priority', 'high')
      .select('id')

    if (error2) {
      log.error('Error updating medium-high priority inbound', { error: error2 })
    } else {
      totalUpdated += mediumHighInbound?.length || 0
      log.info('Set inbound emails to HIGH priority (>24h old)', { count: mediumHighInbound?.length || 0 })
    }

    // ========================================================================
    // RULE 3: Set MEDIUM priority for outbound emails waiting on customer >48h
    // ========================================================================
    const { data: mediumPriorityOutbound, error: error3 } = await supabase
      .from('communications')
      .update({
        priority: 'medium',
        email_status: 'waiting_on_customer',
      })
      .eq('direction', 'outbound')
      .in('email_status', ['needs_reply', 'waiting_on_customer'])
      .lt('sent_at', fortyEightHoursAgo.toISOString())
      .neq('priority', 'medium')
      .select('id')

    if (error3) {
      log.error('Error updating medium priority outbound', { error: error3 })
    } else {
      totalUpdated += mediumPriorityOutbound?.length || 0
      log.info('Set outbound emails to MEDIUM priority (>48h waiting)', { count: mediumPriorityOutbound?.length || 0 })
    }

    // ========================================================================
    // RULE 4: Set LOW priority for recent emails (<24h)
    // ========================================================================
    const { data: lowPriorityRecent, error: error4 } = await supabase
      .from('communications')
      .update({
        priority: 'low',
      })
      .gte('received_at', twentyFourHoursAgo.toISOString())
      .neq('email_status', 'closed')
      .neq('priority', 'low')
      .select('id')

    if (error4) {
      log.error('Error updating low priority recent', { error: error4 })
    } else {
      totalUpdated += lowPriorityRecent?.length || 0
      log.info('Set recent emails to LOW priority (<24h)', { count: lowPriorityRecent?.length || 0 })
    }

    // ========================================================================
    // RULE 5: Find emails that should trigger notifications (customer replied >24h ago)
    // ========================================================================
    // Get the most recent inbound email per thread where:
    // - Customer sent it >24h ago
    // - We haven't replied yet (no outbound email after it)
    // - Status is needs_reply
    // - Priority is high
    const { data: needsAttention, error: error5 } = await supabase
      .from('communications')
      .select('id, subject, from_email, received_at, work_item_id, owner_user_id')
      .eq('direction', 'inbound')
      .eq('email_status', 'needs_reply')
      .eq('priority', 'high')
      .lt('received_at', twentyFourHoursAgo.toISOString())
      .not('owner_user_id', 'is', null)
      .limit(50) // Limit to prevent spam

    if (error5) {
      log.error('Error finding emails needing attention', { error: error5 })
    }

    // ========================================================================
    // RULE 6: Create in-app notifications + send email alerts to owners
    // ========================================================================
    let notificationsSent = 0
    let emailAlertsSent = 0

    if (needsAttention && needsAttention.length > 0) {
      // Group emails by owner
      const byOwner = new Map<string, typeof needsAttention>()
      for (const email of needsAttention) {
        const ownerId = email.owner_user_id!
        if (!byOwner.has(ownerId)) byOwner.set(ownerId, [])
        byOwner.get(ownerId)!.push(email)
      }

      for (const [ownerId, ownerEmails] of byOwner) {
        // Insert in-app notifications (ON CONFLICT = skip duplicates)
        const notifications = ownerEmails.map(email => ({
          user_id: ownerId,
          type: 'high_priority_email',
          title: `"${email.subject || '(no subject)'}" needs your reply`,
          message: `From ${email.from_email} — waiting over 24 hours`,
          link: '/inbox/my-inbox',
          communication_id: email.id,
        }))

        const { data: inserted } = await supabase
          .from('notifications')
          .upsert(notifications, { onConflict: 'communication_id,user_id', ignoreDuplicates: true })
          .select('id')

        const newCount = inserted?.length || 0
        notificationsSent += newCount

        // Send email alert only for NEW notifications (not already sent)
        if (newCount > 0) {
          try {
            const { data: owner } = await supabase
              .from('users')
              .select('email, full_name')
              .eq('id', ownerId)
              .single()

            if (owner?.email) {
              await sendNotificationEmail({
                toEmail: owner.email,
                toName: owner.full_name,
                emails: ownerEmails.slice(0, newCount).map(e => ({
                  subject: e.subject || '(no subject)',
                  from_email: e.from_email,
                  received_at: e.received_at,
                })),
              })

              // Mark notifications as email_sent
              const newIds = inserted!.map(n => n.id)
              await supabase
                .from('notifications')
                .update({ email_sent: true })
                .in('id', newIds)

              emailAlertsSent++
            }
          } catch (emailError) {
            log.error('Failed to send notification email to owner', { error: emailError, ownerId })
          }
        }
      }

      if (notificationsSent > 0) {
        log.info('Notifications created', { notificationsSent, emailAlertsSent, owners: byOwner.size })
      }
    }

    log.info('Priority calculation complete', {
      totalUpdated,
      needsAttentionCount: needsAttention?.length || 0,
      notificationsSent,
      emailAlertsSent,
    })

    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      stats: {
        totalUpdated,
        highPriorityCount: (highPriorityInbound?.length || 0) + (mediumHighInbound?.length || 0),
        mediumPriorityCount: mediumPriorityOutbound?.length || 0,
        lowPriorityCount: lowPriorityRecent?.length || 0,
        needsAttentionCount: needsAttention?.length || 0,
        notificationsSent,
        emailAlertsSent,
      },
      needsAttention: needsAttention || [],
    })
  } catch (error) {
    log.error('Cron job error', { error })
    return serverError(error instanceof Error ? error.message : 'Failed to calculate email priorities')
  }
}
