import { createClient } from '@supabase/supabase-js'
import { htmlToPlainText, smartTruncate } from '@/lib/utils/html-entities'
import { autoCategorizEmail } from '@/lib/utils/email-categorizer'
import { isFormSubmissionEmail, parseFormEmail, isValidFormSubmission } from '@/lib/utils/form-email-parser'

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

    // Calculate lookback date for various linking strategies
    const emailReceivedDate = new Date(message.receivedDateTime)
    const lookbackDate = new Date(emailReceivedDate)
    lookbackDate.setDate(lookbackDate.getDate() - 60)

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

      // Strategy 3: Form submission auto-create lead
      // Detect form submissions and auto-create work items with parsed data
      if (!workItemId && !isOutbound && isFormSubmissionEmail(fromEmail, message.subject || '')) {
        console.log(`[Email Import] Detected form submission from: ${fromEmail}`)

        const parsedData = parseFormEmail(fromEmail, message.subject || '', plainText, bodyContent)

        if (isValidFormSubmission(parsedData)) {
          console.log('[Email Import] Parsed form data:', parsedData)

          // Create work item from form submission
          const { data: newWorkItem, error: workItemError } = await supabase
            .from('work_items')
            .insert({
              type: 'assisted_project',
              source: 'form',
              status: 'new_inquiry',
              customer_name: parsedData!.customerName || parsedData!.customerEmail,
              customer_email: parsedData!.customerEmail,
              title: message.subject || 'Form Inquiry',
              event_date: parsedData!.eventDate,
              notes: parsedData!.projectDetails,
              reason_included: {
                detected_via: 'form_email_parser',
                form_provider: fromEmail,
                parsed_fields: Object.keys(parsedData!.additionalFields),
              },
            })
            .select('id')
            .single()

          if (workItemError) {
            console.error('[Email Import] Failed to create work item from form:', workItemError)
          } else if (newWorkItem) {
            workItemId = newWorkItem.id
            triageStatus = 'created_lead'
            console.log(`[Email Import] Auto-created work item ${workItemId} from form submission`)

            // Calculate initial follow-up date
            try {
              const { data: nextFollowUp } = await supabase
                .rpc('calculate_next_follow_up', { work_item_id: newWorkItem.id })

              if (nextFollowUp !== undefined) {
                await supabase
                  .from('work_items')
                  .update({ next_follow_up_at: nextFollowUp })
                  .eq('id', newWorkItem.id)
              }
            } catch (followUpError) {
              console.error('[Email Import] Error calculating follow-up:', followUpError)
            }

            // Try to link recent emails from the customer email (not the form sender)
            if (parsedData!.customerEmail) {
              const { data: recentEmails } = await supabase
                .from('communications')
                .select('id')
                .eq('from_email', parsedData!.customerEmail)
                .is('work_item_id', null)
                .gte('received_at', lookbackDate.toISOString())

              if (recentEmails && recentEmails.length > 0) {
                await supabase
                  .from('communications')
                  .update({
                    work_item_id: newWorkItem.id,
                    triage_status: 'attached',
                  })
                  .in(
                    'id',
                    recentEmails.map((e: any) => e.id)
                  )

                console.log(`[Email Import] Auto-linked ${recentEmails.length} emails from customer to new work item`)
              }
            }
          }
        } else {
          console.log('[Email Import] Form submission parsing failed or invalid data')
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
 * Form providers that should NOT be filtered as junk
 * even if they match junk patterns (e.g., no-reply@powerfulform.com)
 */
export const FORM_PROVIDER_DOMAINS = [
  'powerfulform.com',
  'forms-noreply@google.com',
  'formstack.com',
  'typeform.com',
  'jotform.com',
  'wufoo.com',
]

/**
 * Check if an email should be filtered as junk
 * Excludes form submission emails even if they match junk patterns
 */
export function isJunkEmail(fromEmail: string, subject?: string): boolean {
  // Check if this is a form submission email (exempt from junk filter)
  const isFormProvider = FORM_PROVIDER_DOMAINS.some(domain =>
    fromEmail.toLowerCase().includes(domain.toLowerCase())
  )

  if (isFormProvider) {
    return false
  }

  // Apply standard junk patterns
  return JUNK_EMAIL_PATTERNS.some((pattern) => pattern.test(fromEmail))
}
