import { NextRequest, NextResponse } from 'next/server'
import { Client } from '@microsoft/microsoft-graph-client'
import { ClientSecretCredential } from '@azure/identity'
import { createClient } from '@supabase/supabase-js'
import jwt from 'jsonwebtoken'
import 'isomorphic-fetch'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
const jwtSecret = process.env.JWT_SECRET || 'fallback-secret-key'

export async function POST(request: NextRequest) {
  try {
    const { workItemId, to, subject, body, attachments, includeApprovalLink } =
      await request.json()

    if (!to || !subject || !body) {
      return NextResponse.json(
        { error: 'Missing required fields: to, subject, body' },
        { status: 400 }
      )
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey)

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

    let emailBody = body

    // Handle approval links if requested
    if (includeApprovalLink && attachments && attachments.length > 0) {
      // Fetch work item
      const { data: workItem } = await supabase
        .from('work_items')
        .select('*')
        .eq('id', workItemId)
        .single()

      if (workItem) {
        // Generate JWT approval tokens (7-day expiry)
        const tokenExpiry = Math.floor(Date.now() / 1000) + 604800
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
        const approveLink = `${baseUrl}/approve-proof?token=${approveToken}`
        const rejectLink = `${baseUrl}/approve-proof?token=${rejectToken}`

        // Append approval links to email body
        emailBody += `

<div style="text-align: center; margin: 30px 0 20px 0; padding-top: 20px; border-top: 2px solid #e5e7eb;">
  <p style="font-weight: 600; margin-bottom: 15px;">Please review and approve:</p>
  <a href="${approveLink}" style="display: inline-block; background-color: #22c55e; color: white; text-decoration: none; padding: 12px 30px; border-radius: 6px; font-weight: 600; margin-right: 10px;">
    ✓ Approve Design
  </a>
  <a href="${rejectLink}" style="display: inline-block; background-color: #ef4444; color: white; text-decoration: none; padding: 12px 30px; border-radius: 6px; font-weight: 600;">
    ✗ Request Changes
  </a>
</div>`

        // Update work item status to awaiting_approval
        await supabase
          .from('work_items')
          .update({
            approval_status: 'awaiting_approval',
            status:
              workItem.type === 'assisted_project'
                ? 'awaiting_approval'
                : workItem.status,
          })
          .eq('id', workItemId)
      }
    }

    // Process file attachments if provided
    const graphAttachments: any[] = []
    if (attachments && attachments.length > 0) {
      for (const fileId of attachments) {
        // Fetch file metadata
        const { data: file } = await supabase
          .from('files')
          .select('*')
          .eq('id', fileId)
          .single()

        if (file) {
          try {
            // Download file from Supabase Storage
            const { data: fileData, error: downloadError } = await supabase.storage
              .from(file.storage_bucket)
              .download(file.storage_path)

            if (downloadError || !fileData) {
              console.error(`Failed to download file ${fileId}:`, downloadError)
              continue
            }

            // Convert to base64
            const arrayBuffer = await fileData.arrayBuffer()
            const base64Content = Buffer.from(arrayBuffer).toString('base64')

            // Check size limit (4MB for Graph API)
            const sizeMB = base64Content.length / 1024 / 1024
            if (sizeMB > 4) {
              console.warn(
                `File ${file.original_filename} exceeds 4MB limit, skipping`
              )
              continue
            }

            // Add to attachments array
            graphAttachments.push({
              '@odata.type': '#microsoft.graph.fileAttachment',
              name: file.original_filename,
              contentBytes: base64Content,
              contentType: file.mime_type || 'application/octet-stream',
            })
          } catch (error) {
            console.error(`Error processing file ${fileId}:`, error)
          }
        }
      }
    }

    // First, check if we're replying to an existing thread
    let threadId = null
    if (workItemId) {
      const { data: existingComms } = await supabase
        .from('communications')
        .select('provider_thread_id')
        .eq('work_item_id', workItemId)
        .not('provider_thread_id', 'is', null)
        .limit(1)
        .single()

      if (existingComms?.provider_thread_id) {
        threadId = existingComms.provider_thread_id
      }
    }

    const mailboxEmail = process.env.MICROSOFT_MAILBOX_EMAIL || 'sales@thegayfanclub.com'

    // Send email via Microsoft Graph
    await client.api(`/users/${mailboxEmail}/sendMail`).post({
      message: {
        subject: subject,
        body: {
          contentType: 'HTML',
          content: emailBody,
        },
        toRecipients: [
          {
            emailAddress: {
              address: to,
            },
          },
        ],
        attachments: graphAttachments.length > 0 ? graphAttachments : undefined,
      },
      saveToSentItems: true,
    })

    // Fetch the sent message from Sent Items to get thread ID
    let messageThreadId = threadId
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

    // Create communication record in database
    const { data, error } = await supabase
      .from('communications')
      .insert({
        work_item_id: workItemId,
        direction: 'outbound',
        from_email: mailboxEmail,
        to_emails: [to],
        subject,
        body_html: emailBody,
        body_preview: body.substring(0, 200).replace(/<[^>]*>/g, ''),
        sent_at: new Date().toISOString(),
        triage_status: 'triaged',
        provider: 'm365',
        provider_thread_id: messageThreadId,
        internet_message_id: internetMessageId,
        has_attachments: graphAttachments.length > 0,
        attachments_meta: graphAttachments.length > 0
          ? graphAttachments.map((a: any) => ({
              name: a.name,
              contentType: a.contentType,
            }))
          : null,
      })
      .select()
      .single()

    if (error) {
      console.error('Failed to log email to database:', error)
      // Don't fail the request if logging fails - email was sent successfully
    }

    return NextResponse.json({ success: true, data })
  } catch (error) {
    console.error('Send email error:', error)
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Failed to send email',
      },
      { status: 500 }
    )
  }
}
