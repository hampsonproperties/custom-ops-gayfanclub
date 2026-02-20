import { NextRequest, NextResponse } from 'next/server'
import { Client } from '@microsoft/microsoft-graph-client'
import { ClientSecretCredential } from '@azure/identity'
import { createClient } from '@supabase/supabase-js'
import jwt from 'jsonwebtoken'
import 'isomorphic-fetch'
import { getTemplateByKey, renderTemplate } from '@/lib/email/templates'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
const jwtSecret = process.env.JWT_SECRET!

if (!jwtSecret) {
  console.error('JWT_SECRET environment variable is not set')
}

export async function POST(request: NextRequest) {
  try {
    const { workItemId, fileId } = await request.json()

    if (!workItemId || !fileId) {
      return NextResponse.json(
        { error: 'Missing required fields: workItemId, fileId' },
        { status: 400 }
      )
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // Fetch work item details
    const { data: workItem, error: workItemError } = await supabase
      .from('work_items')
      .select('*')
      .eq('id', workItemId)
      .single()

    if (workItemError || !workItem) {
      return NextResponse.json(
        { error: 'Work item not found' },
        { status: 404 }
      )
    }

    if (!workItem.customer_email) {
      return NextResponse.json(
        { error: 'Work item has no customer email' },
        { status: 400 }
      )
    }

    // Fetch file details
    const { data: file, error: fileError } = await supabase
      .from('files')
      .select('*')
      .eq('id', fileId)
      .single()

    if (fileError || !file) {
      return NextResponse.json(
        { error: 'File not found' },
        { status: 404 }
      )
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
        .createSignedUrl(file.storage_path, 604800) // 7 days in seconds

      if (signedUrlError || !signedUrlData) {
        return NextResponse.json(
          { error: 'Failed to generate signed URL for proof image' },
          { status: 500 }
        )
      }

      proofImageUrl = signedUrlData.signedUrl
    }

    // Generate JWT approval tokens (7-day expiry)
    const tokenExpiry = Math.floor(Date.now() / 1000) + 604800 // 7 days
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
      return NextResponse.json(
        { error: 'Email template not found' },
        { status: 500 }
      )
    }

    const { subject, body } = renderTemplate(template, {
      customerName: workItem.customer_name || 'there',
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
                address: workItem.customer_email,
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
    const { error: commError } = await supabase
      .from('communications')
      .insert({
        work_item_id: workItemId,
        direction: 'outbound',
        from_email: mailboxEmail,
        to_emails: [workItem.customer_email],
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
      console.error('Failed to log email to database:', commError)
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
      console.error('Failed to update work item status:', updateError)
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
      console.error('[Send Approval Email] Error calculating follow-up:', followUpError)
      // Don't fail the whole operation if follow-up calc fails
    }

    return NextResponse.json({
      success: true,
      message: 'Approval email sent successfully',
    })
  } catch (error) {
    console.error('Send approval email error:', error)
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Failed to send approval email',
      },
      { status: 500 }
    )
  }
}
