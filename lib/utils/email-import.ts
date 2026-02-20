import { createClient } from '@supabase/supabase-js'
import { htmlToPlainText, smartTruncate } from '@/lib/utils/html-entities'
import { autoCategorizEmail } from '@/lib/utils/email-categorizer'
import { isFormSubmissionEmail, parseFormEmail, isValidFormSubmission } from '@/lib/utils/form-email-parser'
import { isDuplicateEmail } from '@/lib/utils/email-deduplication'
import { autoLinkEmailToWorkItem } from '@/lib/utils/order-number-extractor'
import { addToDLQ } from '@/lib/utils/dead-letter-queue'

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
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // Check for duplicates using 3-strategy approach BEFORE processing
    // This prevents race conditions and wasted work on duplicate emails
    const duplicateCheck = await isDuplicateEmail(message)
    if (duplicateCheck.isDuplicate) {
      console.log('[Email Import] Duplicate detected via', duplicateCheck.strategy, {
        messageId: message.id,
        internetMessageId: message.internetMessageId,
        subject: message.subject,
        existingId: duplicateCheck.existingCommunicationId,
        matchedOn: duplicateCheck.matchedOn,
      })
      return {
        success: true,
        action: 'duplicate',
        communicationId: duplicateCheck.existingCommunicationId,
        debug: {
          messageId: message.id,
          from: message.from?.emailAddress?.address || 'unknown',
          to: message.toRecipients?.map((r) => r.emailAddress.address) || [],
          subject: message.subject || '(no subject)',
        },
      }
    }

    // Extract email details
    const fromEmail = message.from?.emailAddress?.address

    // Skip emails without a valid sender (corrupted/draft emails)
    if (!fromEmail || fromEmail.trim() === '') {
      console.log('[Email Import] Skipping email without valid sender', {
        messageId: message.id,
        subject: message.subject,
      })
      return {
        success: false,
        action: 'error',
        error: 'No valid sender email address',
        debug: {
          messageId: message.id,
          from: 'unknown',
          to: message.toRecipients?.map((r) => r.emailAddress.address) || [],
          subject: message.subject || '(no subject)',
        },
      }
    }

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

    // Detect direction - check if from company domain
    const companyDomain = '@thegayfanclub.com'
    const isOutbound = fromEmail.toLowerCase().endsWith(companyDomain)
    const direction = isOutbound ? 'outbound' : 'inbound'

    // Extract body content
    const bodyContent = message.body?.content || ''
    const plainText = htmlToPlainText(bodyContent)
    const bodyPreview = smartTruncate(plainText, 500)

    // Auto-categorization (only for inbound emails, unless skipEnrichment)
    let category = 'primary'
    if (!isOutbound && !skipEnrichment) {
      // STRATEGY 1: Domain-based filters (highest priority - curated list)
      const { data: filterResult } = (await supabase
        .rpc('apply_email_filters', {
          p_from_email: fromEmail,
          p_subject: message.subject || null
        })
        .maybeSingle()) as { data: { matched_category: string; filter_id: string } | null }

      if (filterResult?.matched_category) {
        category = filterResult.matched_category
        console.log(`[Email Import] Domain filter matched: ${fromEmail} → ${category}`)
      } else {
        // STRATEGY 2: Keyword-based fallback (for emails not in filter list)
        category = autoCategorizEmail({
          from: fromEmail,
          subject: message.subject || '',
          body: plainText,
          htmlBody: bodyContent,
        })
        console.log(`[Email Import] Fallback categorization: ${fromEmail} → ${category}`)
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
      // Use enhanced auto-linking (5 strategies: thread, order#, email, title, subject)
      workItemId = await autoLinkEmailToWorkItem(supabase, {
        id: message.id,
        subject: message.subject,
        body: plainText,
        conversationId: message.conversationId,
        from: {
          emailAddress: {
            address: fromEmail
          }
        }
      })

      // Strategy: Form submission auto-create lead
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

      // Strategy: Auto-create lead for primary category emails
      // If email is categorized as "primary" and has no work item, auto-create a lead
      if (!workItemId && !isOutbound && category === 'primary') {
        console.log(`[Email Import] Auto-creating lead for primary email from: ${fromEmail}`)

        const { data: newWorkItem, error: workItemError } = await supabase
          .from('work_items')
          .insert({
            type: 'assisted_project',
            source: 'email',
            status: 'new_inquiry',
            customer_name: fromName,
            customer_email: fromEmail,
            title: message.subject || `Inquiry from ${fromName}`,
            last_contact_at: message.receivedDateTime,
            reason_included: {
              detected_via: 'auto_lead_primary_category',
              original_subject: message.subject,
            },
          })
          .select('id')
          .single()

        if (workItemError) {
          console.error('[Email Import] Failed to auto-create lead:', workItemError)
        } else if (newWorkItem) {
          workItemId = newWorkItem.id
          triageStatus = 'created_lead'
          console.log(`[Email Import] Auto-created lead ${workItemId} for primary email`)

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

          // Try to link recent emails from same sender to this new lead
          const { data: recentEmails } = await supabase
            .from('communications')
            .select('id')
            .eq('from_email', fromEmail)
            .is('work_item_id', null)
            .gte('received_at', lookbackDate.toISOString())

          if (recentEmails && recentEmails.length > 0) {
            await supabase
              .from('communications')
              .update({ work_item_id: newWorkItem.id })
              .in(
                'id',
                recentEmails.map((e: any) => e.id)
              )

            console.log(`[Email Import] Auto-linked ${recentEmails.length} recent emails to new lead`)
          }
        }
      }
    }

    // Insert the email (should not be a duplicate due to check above)
    // Note: internet_message_id and provider_message_id are optional but indexed for performance
    const { data: communication, error: insertError } = await supabase
      .from('communications')
      .insert({
        direction,
        from_email: fromEmail,
        from_name: fromName,
        to_emails: toEmails,
        subject: message.subject || '(no subject)',
        body_html: bodyContent,
        body_preview: bodyPreview,
        received_at: message.receivedDateTime,
        sent_at: isOutbound ? message.sentDateTime : null,
        internet_message_id: message.internetMessageId || null,
        provider: 'm365',
        provider_message_id: message.id,
        provider_thread_id: message.conversationId || null,
        work_item_id: workItemId,
        triage_status: triageStatus,
        category,
        is_read: false,
      })
      .select()
      .single()

    if (insertError) {
      // Check if it's a duplicate (unique constraint violation)
      // This should rarely happen now due to pre-insert duplicate check
      if (insertError.code === '23505') {
        console.warn('[Email Import] Race condition: Duplicate caught at DB level:', {
          providerId: message.id,
          internetMessageId: message.internetMessageId,
          subject: message.subject,
          error: insertError.message,
        })
        return {
          success: true,
          action: 'duplicate',
          debug: {
            messageId: message.id,
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

    // Create or link to conversation thread (CRM model)
    try {
      if (message.conversationId && !skipEnrichment) {
        // Get customer_id from work item if linked
        let customerId = null
        if (workItemId) {
          const { data: workItem } = await supabase
            .from('work_items')
            .select('customer_id')
            .eq('id', workItemId)
            .single()
          customerId = workItem?.customer_id || null
        }

        // Find or create conversation
        const { data: conversationId } = await supabase.rpc('find_or_create_conversation', {
          p_provider: 'm365',
          p_provider_thread_id: message.conversationId,
          p_subject: message.subject || '(no subject)',
          p_customer_id: customerId,
          p_work_item_id: workItemId
        })

        // Link communication to conversation
        if (conversationId) {
          await supabase
            .from('communications')
            .update({ conversation_id: conversationId })
            .eq('id', communication.id)

          console.log(`[Email Import] Linked to conversation: ${conversationId}`)
        }
      }
    } catch (conversationError) {
      // Don't fail the import if conversation creation fails
      console.error('[Email Import] Conversation creation error:', conversationError)
      await addToDLQ({
        operationType: 'other',
        operationKey: `conversation:${message.id}`,
        errorMessage: conversationError instanceof Error ? conversationError.message : 'Unknown error',
        errorStack: conversationError instanceof Error ? conversationError.stack : undefined,
        operationPayload: {
          messageId: message.id,
          conversationId: message.conversationId,
          workItemId
        },
        communicationId: communication.id,
      })
    }

    console.log('[Email Import] Successfully imported:', {
      communicationId: communication.id,
      providerId: message.id,
      internetMessageId: message.internetMessageId,
      subject: message.subject,
      direction,
      workItemId: workItemId || null,
    })

    return {
      success: true,
      action: 'inserted',
      communicationId: communication.id,
      workItemId: workItemId || undefined,
      direction,
      debug: {
        messageId: message.id,
        from: fromEmail,
        to: toEmails,
        subject: message.subject || '(no subject)',
      },
    }
  } catch (error) {
    console.error('[Email Import] Unexpected error:', error)

    // Add to DLQ for retry
    await addToDLQ({
      operationType: 'email_import',
      operationKey: `email:${message.id}`,
      errorMessage: error instanceof Error ? error.message : 'Unknown error',
      errorStack: error instanceof Error ? error.stack : undefined,
      operationPayload: {
        messageId: message.id,
        internetMessageId: message.internetMessageId,
        subject: message.subject,
        from: message.from?.emailAddress?.address,
        receivedDateTime: message.receivedDateTime
      },
    }).catch((dlqError) => {
      // Don't fail if DLQ fails
      console.error('[Email Import] Failed to add to DLQ:', dlqError)
    })

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
