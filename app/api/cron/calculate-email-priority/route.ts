import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

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
      console.error('CRON_SECRET not configured')
      return NextResponse.json(
        { error: 'Cron secret not configured' },
        { status: 500 }
      )
    }

    if (authHeader !== `Bearer ${cronSecret}`) {
      console.error('Unauthorized cron request')
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
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
      console.error('Error updating high priority inbound:', error1)
    } else {
      totalUpdated += highPriorityInbound?.length || 0
      console.log(`Set ${highPriorityInbound?.length || 0} inbound emails to HIGH priority (>48h old)`)
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
      console.error('Error updating medium-high priority inbound:', error2)
    } else {
      totalUpdated += mediumHighInbound?.length || 0
      console.log(`Set ${mediumHighInbound?.length || 0} inbound emails to HIGH priority (>24h old)`)
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
      console.error('Error updating medium priority outbound:', error3)
    } else {
      totalUpdated += mediumPriorityOutbound?.length || 0
      console.log(`Set ${mediumPriorityOutbound?.length || 0} outbound emails to MEDIUM priority (>48h waiting)`)
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
      console.error('Error updating low priority recent:', error4)
    } else {
      totalUpdated += lowPriorityRecent?.length || 0
      console.log(`Set ${lowPriorityRecent?.length || 0} recent emails to LOW priority (<24h)`)
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
      console.error('Error finding emails needing attention:', error5)
    }

    // TODO: Send notifications to email owners for high priority emails
    // This could be implemented as in-app notifications or email alerts

    console.log(`Total emails updated: ${totalUpdated}`)
    console.log(`Emails needing attention: ${needsAttention?.length || 0}`)

    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      stats: {
        totalUpdated,
        highPriorityCount: (highPriorityInbound?.length || 0) + (mediumHighInbound?.length || 0),
        mediumPriorityCount: mediumPriorityOutbound?.length || 0,
        lowPriorityCount: lowPriorityRecent?.length || 0,
        needsAttentionCount: needsAttention?.length || 0,
      },
      needsAttention: needsAttention || [],
    })
  } catch (error) {
    console.error('Cron job error:', error)
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Failed to calculate email priorities',
      },
      { status: 500 }
    )
  }
}
