import { NextRequest, NextResponse } from 'next/server'
import { Client } from '@microsoft/microsoft-graph-client'
import { ClientSecretCredential } from '@azure/identity'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/server'
import jwt from 'jsonwebtoken'
import 'isomorphic-fetch'
import { getTemplateByKey, renderTemplate } from '@/lib/email/templates'
import { validateBody } from '@/lib/api/validate'
import { approvalEmailBody } from '@/lib/api/schemas'
import { badRequest, unauthorized, notFound, serverError } from '@/lib/api/errors'
import { logger } from '@/lib/logger'
import { APPROVAL_TOKEN_EXPIRY_SECONDS } from '@/lib/config'

const log = logger('send-approval-email')

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
const jwtSecret = process.env.JWT_SECRET!

if (!jwtSecret) {
  log.error('JWT_SECRET environment variable is not set')
}

export async function POST(request: NextRequest) {
  try {
    const authClient = await createClient()
    const { data: { user } } = await authClient.auth.getUser()
    if (!user) return unauthorized()

    const bodyResult = validateBody(await request.json(), approvalEmailBody)
    if (bodyResult.error) return bodyResult.error
    const { workItemId, fileId } = bodyResult.data

    const supabase = createServiceClient(supabaseUrl, supabaseServiceKey)

    // Fetch work item details
    const { data: workItem, error: workItemError } = await supabase
      .from('work_items')
      .select('*, customer:customers(display_name, email, organization_name, phone)')
      .eq('id', workItemId)
      .single()

    if (workItemError || !workItem) {
      return notFound('Work item not found')
    }

    const customerEmail = workItem.customer?.email || workItem.customer_email
    const customerName = workItem.customer?.display_name || workItem.customer_name

    if (!customerEmail) {
      return badRequest('Work item has no customer email')
    }

    // Fetch file details
    const { data: file, error: fileError } = await supabase
      .from('files')
      .select('*')
      .eq('id', fileId)
      .single()

    if (fileError || !file) {
      return notFound('File not found')
    }

    // Get proof image URL
    let proofImageUrl: string

    // If it's an external file (Customify), use the URL directly
    if (file.storage_bucket === 'customify' || file.storage_bucket === 'external') {
      proofImageUrl = file.storage_path
    } else {
      // For Supabase storage files, generate signed URL (7-day expiry)
      const { data: signedUrlData, error: signedUrlError } = await supabase
        .storage
        .from(file.storage_bucket)
        .createSignedUrl(file.storage_path, APPROVAL_TOKEN_EXPIRY_SECONDS)

      if (signedUrlError || !signedUrlData) {
        return serverError('Failed to generate signed URL for proof image')
      }

      proofImageUrl = signedUrlData.signedUrl
    }

    // Generate JWT approval tokens (7-day expiry)
    const tokenExpiry = Math.floor(Date.now() / 1000) + APPROVAL_TOKEN_EXPIRY_SECONDS
    const approveToken = jwt.sign(
      {
        workItemId,
        action: 'approve',
        exp: tokenExpiry,
      },
      jwtSecret
    )

    const rejectToken = jwt.sign(
      {
        workItemId,
        action: 'reject',
        exp: tokenExpiry,
      },
      jwtSecret
    )

    // Store tokens in database
    const expiresAt = new Date(tokenExpiry * 1000).toISOString()

    await supabase.from('approval_tokens').insert([
      {
        work_item_id: workItemId,
        token: approveToken,
        expires_at: expiresAt,
        action: 'approve',
      },
      {
        work_item_id: workItemId,
        token: rejectToken,
        expires_at: expiresAt,
        action: 'reject',
      },
    ])

    // Generate approval links
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
    const approveLink = `${baseUrl}/api/approve-proof?token=${approveToken}`
    const rejectLink = `${baseUrl}/request-changes?token=${rejectToken}`

    // Load and render template
    const template = await getTemplateByKey('customify-proof-approval')

    if (!template) {
      return serverError('Email template not found')
    }

    const { subject, body } = renderTemplate(template, {
      customerName: customerName || 'there',
      orderNumber: workItem.shopify_order_number || workItem.id,
      proofImageUrl,
      approveLink,
      rejectLink,
    })

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
    await client
      .api(`/users/${mailboxEmail}/sendMail`)
      .post({
        message: {
          subject,
          body: {
            contentType: 'HTML',
            content: body,
          },
          toRecipients: [
            {
              emailAddress: {
                address: customerEmail,
              },
            },
          ],
        },
        saveToSentItems: true,
      })

    // Fetch the sent message from Sent Items to get thread ID
    let messageThreadId = null
    let internetMessageId = null

    try {
      // Small delay to allow Exchange to index the sent message
      await new Promise(resolve => setTimeout(resolve, 1000))

      const sentItems = await client
        .api(`/users/${mailboxEmail}/mailFolders/SentItems/messages`)
        .top(1)
        .orderby('sentDateTime desc')
        .filter(`subject eq '${subject.replace(/'/g, "''")}'`)
        .select('conversationId,internetMessageId')
        .get()

      if (sentItems.value && sentItems.value.length > 0) {
        messageThreadId = sentItems.value[0].conversationId
        internetMessageId = sentItems.value[0].internetMessageId
      }
    } catch (error) {
      log.error('Failed to fetch sent message metadata', { error })
    }

    // Create communication record
    const { error: commError } = await supabase
      .from('communications')
      .insert({
        work_item_id: workItemId,
        direction: 'outbound',
        from_email: mailboxEmail,
        to_emails: [customerEmail],
        subject,
        body_html: body,
        body_preview: subject,
        sent_at: new Date().toISOString(),
        triage_status: 'triaged',
        provider: 'm365',
        provider_thread_id: messageThreadId,
        internet_message_id: internetMessageId,
      })

    if (commError) {
      log.error('Failed to log email to database', { error: commError })
    }

    // Update work item status to awaiting_approval
    const { error: updateError } = await supabase
      .from('work_items')
      .update({
        approval_status: 'awaiting_approval',
        status: workItem.type === 'assisted_project' ? 'awaiting_approval' : workItem.status,
      })
      .eq('id', workItemId)

    if (updateError) {
      log.error('Failed to update work item status', { error: updateError, workItemId })
    }

    // Recalculate next follow-up after status change
    try {
      const { data: nextFollowUp } = await supabase
        .rpc('calculate_next_follow_up', { work_item_id: workItemId })

      if (nextFollowUp !== undefined) {
        await supabase
          .from('work_items')
          .update({ next_follow_up_at: nextFollowUp })
          .eq('id', workItemId)
      }
    } catch (followUpError) {
      log.error('Error calculating follow-up', { error: followUpError, workItemId })
      // Don't fail the whole operation if follow-up calc fails
    }

    return NextResponse.json({
      success: true,
      message: 'Approval email sent successfully',
    })
  } catch (error) {
    log.error('Send approval email error', { error })
    return serverError(error instanceof Error ? error.message : 'Failed to send approval email')
  }
}
