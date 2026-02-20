import { createClient } from '@supabase/supabase-js'
import { getAndRenderTemplate } from './templates'
import { Client } from '@microsoft/microsoft-graph-client'
import { ClientSecretCredential } from '@azure/identity'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

type BatchEmailType = 'entering_production' | 'midway_checkin' | 'en_route' | 'arrived_stateside'

interface QueueBatchEmailParams {
  batchId: string
  workItemId: string
  emailType: BatchEmailType
  recipientEmail: string
  recipientName?: string
  scheduledSendAt: Date
  expectedBatchStatus?: string
  expectedHasTracking?: boolean
}

interface SendBatchEmailParams {
  queueItemId: string
  batchId: string
  workItemId: string
  emailType: BatchEmailType
  recipientEmail: string
  recipientName?: string
}

/**
 * Get all email recipients for a work item (primary + alternates)
 */
export async function getWorkItemRecipients(workItemId: string): Promise<{
  primaryEmail: string | null
  alternateEmails: string[]
  customerName: string | null
}> {
  const supabase = createClient(supabaseUrl, supabaseServiceKey)

  const { data: workItem } = await supabase
    .from('work_items')
    .select('customer_email, alternate_emails, customer_name')
    .eq('id', workItemId)
    .single()

  if (!workItem) {
    return { primaryEmail: null, alternateEmails: [], customerName: null }
  }

  return {
    primaryEmail: workItem.customer_email,
    alternateEmails: workItem.alternate_emails || [],
    customerName: workItem.customer_name,
  }
}

/**
 * Queue a batch email for delayed send with verification
 */
export async function queueBatchEmail(params: QueueBatchEmailParams): Promise<{ success: boolean; error?: string }> {
  const supabase = createClient(supabaseUrl, supabaseServiceKey)

  // Check if already queued or sent
  const { data: existingQueue } = await supabase
    .from('batch_email_queue')
    .select('id, status')
    .eq('batch_id', params.batchId)
    .eq('work_item_id', params.workItemId)
    .eq('email_type', params.emailType)
    .single()

  if (existingQueue) {
    if (existingQueue.status === 'pending') {
      return { success: true, error: 'Already queued' }
    }
    if (existingQueue.status === 'sent') {
      return { success: false, error: 'Already sent' }
    }
  }

  const { data: existingSend } = await supabase
    .from('batch_email_sends')
    .select('id')
    .eq('batch_id', params.batchId)
    .eq('work_item_id', params.workItemId)
    .eq('email_type', params.emailType)
    .single()

  if (existingSend) {
    return { success: false, error: 'Already sent' }
  }

  // Queue the email
  const { error } = await supabase.from('batch_email_queue').insert({
    batch_id: params.batchId,
    work_item_id: params.workItemId,
    email_type: params.emailType,
    recipient_email: params.recipientEmail,
    recipient_name: params.recipientName || null,
    scheduled_send_at: params.scheduledSendAt.toISOString(),
    expected_batch_status: params.expectedBatchStatus || null,
    expected_has_tracking: params.expectedHasTracking || false,
    status: 'pending',
  })

  if (error) {
    console.error('Failed to queue batch email:', error)
    return { success: false, error: error.message }
  }

  return { success: true }
}

/**
 * Queue batch emails for all recipients of a work item
 */
export async function queueBatchEmailsForWorkItem(params: Omit<QueueBatchEmailParams, 'recipientEmail' | 'recipientName'>): Promise<{
  success: boolean
  queued: number
  errors: string[]
}> {
  const recipients = await getWorkItemRecipients(params.workItemId)
  const errors: string[] = []
  let queued = 0

  // Queue for primary email
  if (recipients.primaryEmail) {
    const result = await queueBatchEmail({
      ...params,
      recipientEmail: recipients.primaryEmail,
      recipientName: recipients.customerName || undefined,
    })

    if (result.success) {
      queued++
    } else if (result.error && !result.error.includes('Already')) {
      errors.push(`Primary (${recipients.primaryEmail}): ${result.error}`)
    }
  }

  // Queue for alternate emails
  for (const altEmail of recipients.alternateEmails) {
    const result = await queueBatchEmail({
      ...params,
      recipientEmail: altEmail,
      recipientName: recipients.customerName || undefined,
    })

    if (result.success) {
      queued++
    } else if (result.error && !result.error.includes('Already')) {
      errors.push(`Alternate (${altEmail}): ${result.error}`)
    }
  }

  return { success: errors.length === 0, queued, errors }
}

/**
 * Verify that conditions still match before sending email
 */
export async function verifyEmailConditions(queueItemId: string): Promise<{
  valid: boolean
  reason?: string
}> {
  const supabase = createClient(supabaseUrl, supabaseServiceKey)

  // Get queue item
  const { data: queueItem } = await supabase
    .from('batch_email_queue')
    .select('*')
    .eq('id', queueItemId)
    .single()

  if (!queueItem) {
    return { valid: false, reason: 'Queue item not found' }
  }

  // Get batch
  const { data: batch } = await supabase
    .from('batches')
    .select('id, status, tracking_number')
    .eq('id', queueItem.batch_id)
    .single()

  if (!batch) {
    return { valid: false, reason: 'Batch not found or deleted' }
  }

  // Get work item
  const { data: workItem } = await supabase
    .from('work_items')
    .select('id, batch_id')
    .eq('id', queueItem.work_item_id)
    .single()

  if (!workItem) {
    return { valid: false, reason: 'Work item not found or deleted' }
  }

  // Check if work item still in batch
  if (workItem.batch_id !== queueItem.batch_id) {
    return { valid: false, reason: 'Work item removed from batch' }
  }

  // Check expected batch status
  if (queueItem.expected_batch_status && batch.status !== queueItem.expected_batch_status) {
    return { valid: false, reason: `Batch status changed from ${queueItem.expected_batch_status} to ${batch.status}` }
  }

  // Check tracking number requirement
  if (queueItem.expected_has_tracking && !batch.tracking_number) {
    return { valid: false, reason: 'Tracking number removed' }
  }

  return { valid: true }
}

/**
 * Get template key for email type
 */
function getTemplateKeyForEmailType(emailType: BatchEmailType): string {
  const mapping: Record<BatchEmailType, string> = {
    entering_production: 'batch-entering-production',
    midway_checkin: 'batch-midway-checkin',
    en_route: 'batch-en-route',
    arrived_stateside: 'batch-arrived-stateside',
  }
  return mapping[emailType]
}

/**
 * Send a batch email using Microsoft Graph
 */
export async function sendBatchEmail(params: SendBatchEmailParams): Promise<{
  success: boolean
  communicationId?: string
  error?: string
}> {
  const supabase = createClient(supabaseUrl, supabaseServiceKey)

  try {
    // Get work item for merge fields
    const { data: workItem } = await supabase
      .from('work_items')
      .select('customer_name, customer_email, shopify_order_number')
      .eq('id', params.workItemId)
      .single()

    if (!workItem) {
      return { success: false, error: 'Work item not found' }
    }

    // Get first name from customer name
    const firstName = workItem.customer_name?.split(' ')[0] || 'there'

    // Render template
    const templateKey = getTemplateKeyForEmailType(params.emailType)
    const rendered = await getAndRenderTemplate(templateKey, {
      first_name: firstName,
      shop_url: 'https://www.thegayfanclub.com',
      discount_code: 'WAIT20',
    })

    if (!rendered) {
      return { success: false, error: 'Email template not found' }
    }

    // Initialize Microsoft Graph client
    const credential = new ClientSecretCredential(
      process.env.MICROSOFT_TENANT_ID!,
      process.env.MICROSOFT_CLIENT_ID!,
      process.env.MICROSOFT_CLIENT_SECRET!
    )

    const client = Client.initWithMiddleware({
      authProvider: {
        getAccessToken: async () => {
          const token = await credential.getToken('https://graph.microsoft.com/.default')
          return token.token
        },
      },
    })

    const mailboxEmail = process.env.MICROSOFT_MAILBOX_EMAIL || 'sales@thegayfanclub.com'

    // Send email via Microsoft Graph
    await client.api(`/users/${mailboxEmail}/sendMail`).post({
      message: {
        subject: rendered.subject,
        body: {
          contentType: 'HTML',
          content: rendered.body,
        },
        toRecipients: [
          {
            emailAddress: {
              address: params.recipientEmail,
              name: params.recipientName,
            },
          },
        ],
      },
      saveToSentItems: true,
    })

    // Fetch the sent message to get thread ID
    let messageThreadId = null
    let internetMessageId = null

    try {
      const sentItems = await client
        .api(`/users/${mailboxEmail}/mailFolders/SentItems/messages`)
        .top(1)
        .orderby('sentDateTime desc')
        .select('conversationId,internetMessageId')
        .get()

      if (sentItems.value && sentItems.value.length > 0) {
        messageThreadId = sentItems.value[0].conversationId
        internetMessageId = sentItems.value[0].internetMessageId
      }
    } catch (error) {
      console.error('Failed to fetch sent message metadata:', error)
    }

    // Create communication record
    const { data: communication, error: commError } = await supabase
      .from('communications')
      .insert({
        work_item_id: params.workItemId,
        direction: 'outbound',
        from_email: mailboxEmail,
        to_emails: [params.recipientEmail],
        subject: rendered.subject,
        body_html: rendered.body,
        body_preview: rendered.subject,
        sent_at: new Date().toISOString(),
        triage_status: 'triaged',
        provider: 'm365',
        provider_thread_id: messageThreadId,
        internet_message_id: internetMessageId,
      })
      .select('id')
      .single()

    if (commError) {
      console.error('Failed to log email to database:', commError)
    }

    // Record in batch_email_sends for audit trail
    await supabase.from('batch_email_sends').insert({
      batch_id: params.batchId,
      work_item_id: params.workItemId,
      email_type: params.emailType,
      recipient_email: params.recipientEmail,
      communication_id: communication?.id || null,
      queue_item_id: params.queueItemId,
      template_key: templateKey,
    })

    return { success: true, communicationId: communication?.id }
  } catch (error) {
    console.error('Failed to send batch email:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}

/**
 * Cancel a pending batch email
 */
export async function cancelBatchEmail(queueItemId: string, reason: string): Promise<{ success: boolean; error?: string }> {
  const supabase = createClient(supabaseUrl, supabaseServiceKey)

  const { error } = await supabase
    .from('batch_email_queue')
    .update({
      status: 'cancelled',
      cancelled_at: new Date().toISOString(),
      cancellation_reason: reason,
    })
    .eq('id', queueItemId)
    .eq('status', 'pending')

  if (error) {
    return { success: false, error: error.message }
  }

  return { success: true }
}

/**
 * Mark queue item as sent
 */
export async function markQueueItemSent(queueItemId: string): Promise<{ success: boolean; error?: string }> {
  const supabase = createClient(supabaseUrl, supabaseServiceKey)

  const { error } = await supabase
    .from('batch_email_queue')
    .update({
      status: 'sent',
      sent_at: new Date().toISOString(),
    })
    .eq('id', queueItemId)

  if (error) {
    return { success: false, error: error.message }
  }

  return { success: true }
}

/**
 * Mark queue item as failed
 */
export async function markQueueItemFailed(queueItemId: string, errorMessage: string): Promise<{ success: boolean; error?: string }> {
  const supabase = createClient(supabaseUrl, supabaseServiceKey)

  const { error } = await supabase
    .from('batch_email_queue')
    .update({
      status: 'failed',
      error_message: errorMessage,
    })
    .eq('id', queueItemId)

  if (error) {
    return { success: false, error: error.message }
  }

  return { success: true }
}
