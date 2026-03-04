import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { logger } from '@/lib/logger'
import { serverError } from '@/lib/api/errors'

const log = logger('email-cleanup')


export async function POST() {
  try {
    const supabase = await createClient()
    const mailboxEmail = process.env.MICROSOFT_MAILBOX_EMAIL || 'sales@thegayfanclub.com'

    // Find all emails that are FROM sales@ but marked as inbound
    const { data: outboundEmails, error: fetchError } = await supabase
      .from('communications')
      .select('id, from_email')
      .eq('from_email', mailboxEmail)
      .eq('direction', 'inbound')

    if (fetchError) throw fetchError

    if (!outboundEmails || outboundEmails.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No emails to clean up',
        updated: 0,
      })
    }

    // Update them to be outbound and archived
    const { error: updateError } = await supabase
      .from('communications')
      .update({
        direction: 'outbound',
        triage_status: 'archived',
      })
      .eq('from_email', mailboxEmail)
      .eq('direction', 'inbound')

    if (updateError) throw updateError

    return NextResponse.json({
      success: true,
      message: `Updated ${outboundEmails.length} outbound emails`,
      updated: outboundEmails.length,
    })
  } catch (error) {
    log.error('Cleanup error', { error })
    return serverError(error instanceof Error ? error.message : 'Failed to clean up emails')
  }
}
