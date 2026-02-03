import { createClient } from '@supabase/supabase-js'
import { htmlToPlainText, smartTruncate } from '@/lib/utils/html-entities'
import { autoCategorizEmail } from '@/lib/utils/email-categorizer'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

interface GraphMessage {
  id: string
  internetMessageId: string
  subject: string | null
  from?: {
    emailAddress: {
      address: string
      name?: string
    }
  }
  toRecipients?: Array<{
    emailAddress: {
      address: string
      name?: string
    }
  }>
  body?: {
    content: string
    contentType: string
  }
  receivedDateTime: string
  sentDateTime?: string
  conversationId: string
}

interface EmailImportOptions {
  /** Skip auto-categorization and auto-linking (faster for bulk imports) */
  skipEnrichment?: boolean
  /** Custom mailbox email to check for outbound detection */
  mailboxEmail?: string
}

interface EmailImportResult {
  success: boolean
  action: 'inserted' | 'duplicate' | 'error'
  communicationId?: string
  workItemId?: string
  direction?: 'inbound' | 'outbound'
  error?: string
  debug?: {
    messageId: string
    from: string
    to: string[]
    subject: string
  }
}

/**
 * Centralized email import function with race-condition-safe deduplication
 * Uses PostgreSQL upsert to prevent duplicate imports across multiple processes
 */
export async function importEmail(
  message: GraphMessage,
  options: EmailImportOptions = {}
): Promise<EmailImportResult> {
  const { skipEnrichment = false, mailboxEmail = 'sales@thegayfanclub.com' } = options

  try {
    // Validate required fields
    if (!message.internetMessageId) {
      console.error('Email missing internet_message_id - cannot import safely', {
        messageId: message.id,
        subject: message.subject,
      })
      return {
        success: false,
        action: 'error',
        error: 'Missing internet_message_id',
      }
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // Extract email details
    const fromEmail = message.from?.emailAddress?.address || 'unknown@unknown.com'
    const fromName = message.from?.emailAddress?.name || fromEmail
    const toEmails = message.toRecipients?.map((r) => r.emailAddress.address) || []

    // Log raw message data to debug sender issues
    console.log('[Email Import] Processing message:', {
      internetMessageId: message.internetMessageId,
      providerId: message.id,
      from_address: fromEmail,
      from_name: fromName,
      to_addresses: toEmails,
      subject: message.subject,
      timestamp: message.receivedDateTime,
    })

    // Detect direction
    const isOutbound = fromEmail.toLowerCase() === mailboxEmail.toLowerCase()
    const direction = isOutbound ? 'outbound' : 'inbound'

    // Extract body content
    const bodyContent = message.body?.content || ''
    const plainText = htmlToPlainText(bodyContent)
    const bodyPreview = smartTruncate(plainText, 500)

    // Auto-categorization (only for inbound emails, unless skipEnrichment)
    let category = 'primary'
    if (!isOutbound && !skipEnrichment) {
      category = autoCategorizEmail({
        from: fromEmail,
        subject: message.subject || '',
        body: plainText,
        htmlBody: bodyContent,
      })
      console.log(`[Email Import] Auto-categorized: ${fromEmail} → ${category}`)

      // Check for manual filters (user overrides)
      const { data: filterResult } = (await supabase
        .rpc('apply_email_filters', { p_from_email: fromEmail })
        .maybeSingle()) as { data: { matched_category: string; filter_id: string } | null }

      if (filterResult?.matched_category) {
        category = filterResult.matched_category
        console.log(`[Email Import] Manual filter override: ${fromEmail} → ${category}`)
      }
    }

    // Auto-link to work items (unless skipEnrichment)
    let workItemId = null
    let triageStatus = isOutbound ? 'archived' : 'untriaged'

    if (!skipEnrichment) {
      // Strategy 1: Thread-based linking
      if (message.conversationId) {
        const { data: threadEmail } = await supabase
          .from('communications')
          .select('work_item_id')
          .eq('provider_thread_id', message.conversationId)
          .not('work_item_id', 'is', null)
          .limit(1)
          .maybeSingle()

        if (threadEmail?.work_item_id) {
          workItemId = threadEmail.work_item_id
          console.log(
            `[Email Import] Auto-linked to work item ${workItemId} (thread: ${message.conversationId})`
          )
        }
      }

      // Strategy 2: Email-based linking (only for inbound, 60-day window)
      if (!workItemId && !isOutbound) {
        const emailReceivedDate = new Date(message.receivedDateTime)
        const lookbackDate = new Date(emailReceivedDate)
        lookbackDate.setDate(lookbackDate.getDate() - 60)

        const { data: recentWorkItem } = await supabase
          .from('work_items')
          .select('id')
          .or(`customer_email.eq.${fromEmail},alternate_emails.cs.{${fromEmail}}`)
          .is('closed_at', null)
          .gte('updated_at', lookbackDate.toISOString())
          .order('updated_at', { ascending: false })
          .limit(1)
          .maybeSingle()

        if (recentWorkItem) {
          workItemId = recentWorkItem.id
          console.log(
            `[Email Import] Auto-linked to work item ${workItemId} (email match within 60 days)`
          )
        }
      }
    }

    // Use INSERT ... ON CONFLICT to prevent race conditions
    // This is atomic at the database level
    const { data: communication, error: insertError } = await supabase
      .from('communications')
      .insert({
        direction,
        from_email: fromEmail,
        to_emails: toEmails,
        subject: message.subject || '(no subject)',
        body_html: bodyContent,
        body_preview: bodyPreview,
        received_at: message.receivedDateTime,
        sent_at: isOutbound ? message.sentDateTime : null,
        internet_message_id: message.internetMessageId,
        provider: 'm365',
        provider_message_id: message.id,
        provider_thread_id: message.conversationId,
        work_item_id: workItemId,
        triage_status: triageStatus,
        category,
        is_read: false,
      })
      .select()
      .single()

    if (insertError) {
      // Check if it's a duplicate (unique constraint violation)
      if (insertError.code === '23505') {
        console.log('[Email Import] Duplicate detected (already imported):', {
          internetMessageId: message.internetMessageId,
          subject: message.subject,
        })
        return {
          success: true,
          action: 'duplicate',
          debug: {
            messageId: message.internetMessageId,
            from: fromEmail,
            to: toEmails,
            subject: message.subject || '(no subject)',
          },
        }
      }

      // Other database error
      console.error('[Email Import] Database error:', insertError)
      return {
        success: false,
        action: 'error',
        error: insertError.message,
      }
    }

    console.log('[Email Import] Successfully imported:', {
      communicationId: communication.id,
      internetMessageId: message.internetMessageId,
      subject: message.subject,
    })

    return {
      success: true,
      action: 'inserted',
      communicationId: communication.id,
      workItemId: workItemId || undefined,
      direction,
      debug: {
        messageId: message.internetMessageId,
        from: fromEmail,
        to: toEmails,
        subject: message.subject || '(no subject)',
      },
    }
  } catch (error) {
    console.error('[Email Import] Unexpected error:', error)
    return {
      success: false,
      action: 'error',
      error: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}

/**
 * Junk email patterns to filter out
 */
export const JUNK_EMAIL_PATTERNS = [
  /^noreply@/i,
  /^no-reply@/i,
  /^donotreply@/i,
  /^do-not-reply@/i,
  /^automated@/i,
  /^notifications@/i,
  /^bounce@/i,
  /^mailer-daemon@/i,
]

/**
 * Check if an email should be filtered as junk
 */
export function isJunkEmail(fromEmail: string): boolean {
  return JUNK_EMAIL_PATTERNS.some((pattern) => pattern.test(fromEmail))
}
