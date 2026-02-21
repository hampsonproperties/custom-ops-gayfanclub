import { NextRequest, NextResponse } from 'next/server'
import { Client } from '@microsoft/microsoft-graph-client'

/**
 * Download email attachment from Microsoft Graph
 * GET /api/email/attachments/{messageId}/{attachmentId}
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { messageId: string; attachmentId: string } }
) {
  try {
    const { messageId, attachmentId } = params

    // Get access token for Microsoft Graph
    const tenantId = process.env.MICROSOFT_TENANT_ID
    const clientId = process.env.MICROSOFT_CLIENT_ID
    const clientSecret = process.env.MICROSOFT_CLIENT_SECRET
    const mailboxEmail = 'sales@thegayfanclub.com'

    if (!tenantId || !clientId || !clientSecret) {
      return NextResponse.json(
        { error: 'Missing Microsoft Graph credentials' },
        { status: 500 }
      )
    }

    // Get OAuth token
    const tokenUrl = `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`
    const tokenParams = new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      scope: 'https://graph.microsoft.com/.default',
      grant_type: 'client_credentials',
    })

    const tokenResponse = await fetch(tokenUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: tokenParams.toString(),
    })

    if (!tokenResponse.ok) {
      return NextResponse.json(
        { error: 'Failed to get access token' },
        { status: 500 }
      )
    }

    const { access_token } = await tokenResponse.json()

    // Create Microsoft Graph client
    const client = Client.init({
      authProvider: (done) => {
        done(null, access_token)
      },
    })

    // Fetch attachment content from Microsoft Graph
    const attachment = await client
      .api(`/users/${mailboxEmail}/messages/${messageId}/attachments/${attachmentId}`)
      .get()

    // Extract content bytes (base64 encoded)
    const contentBytes = attachment.contentBytes
    if (!contentBytes) {
      return NextResponse.json(
        { error: 'Attachment content not found' },
        { status: 404 }
      )
    }

    // Decode base64 to binary
    const buffer = Buffer.from(contentBytes, 'base64')

    // Return file with appropriate headers
    return new NextResponse(buffer, {
      headers: {
        'Content-Type': attachment.contentType || 'application/octet-stream',
        'Content-Disposition': `attachment; filename="${attachment.name || 'download'}"`,
        'Content-Length': buffer.length.toString(),
      },
    })
  } catch (error) {
    console.error('[Attachment Download] Error:', error)
    return NextResponse.json(
      { error: 'Failed to download attachment' },
      { status: 500 }
    )
  }
}
