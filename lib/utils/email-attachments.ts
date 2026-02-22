import { createClient } from '@supabase/supabase-js'
import { Client } from '@microsoft/microsoft-graph-client'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

interface AttachmentMeta {
  id: string
  name: string
  contentType: string
  size: number
  provider: string
  provider_attachment_id: string
}

interface DownloadAttachmentsResult {
  success: boolean
  downloadedCount: number
  errors: string[]
}

/**
 * Download email attachments from Microsoft Graph and save to Supabase
 */
export async function downloadAndSaveEmailAttachments(
  communicationId: string,
  workItemId: string | null,
  messageId: string,
  attachments: AttachmentMeta[]
): Promise<DownloadAttachmentsResult> {
  const supabase = createClient(supabaseUrl, supabaseServiceKey)
  const errors: string[] = []
  let downloadedCount = 0

  // Filter out inline images (they're embedded in the email body)
  const downloadableAttachments = attachments.filter(a => !a.name?.startsWith('image'))

  if (downloadableAttachments.length === 0) {
    return { success: true, downloadedCount: 0, errors: [] }
  }

  try {
    // Get Microsoft Graph access token
    const tenantId = process.env.MICROSOFT_TENANT_ID
    const clientId = process.env.MICROSOFT_CLIENT_ID
    const clientSecret = process.env.MICROSOFT_CLIENT_SECRET
    const mailboxEmail = 'sales@thegayfanclub.com'

    if (!tenantId || !clientId || !clientSecret) {
      console.error('[Email Attachments] Missing Microsoft Graph credentials')
      return {
        success: false,
        downloadedCount: 0,
        errors: ['Missing Microsoft Graph credentials']
      }
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
      console.error('[Email Attachments] Failed to get access token')
      return {
        success: false,
        downloadedCount: 0,
        errors: ['Failed to authenticate with Microsoft Graph']
      }
    }

    const { access_token } = await tokenResponse.json()

    // Create Microsoft Graph client
    const client = Client.init({
      authProvider: (done) => {
        done(null, access_token)
      },
    })

    // Download each attachment
    for (const attachment of downloadableAttachments) {
      try {
        console.log(`[Email Attachments] Downloading: ${attachment.name}`)

        // Fetch attachment from Microsoft Graph
        const graphAttachment = await client
          .api(`/users/${mailboxEmail}/messages/${messageId}/attachments/${attachment.provider_attachment_id}`)
          .get()

        // Extract content bytes (base64 encoded)
        const contentBytes = graphAttachment.contentBytes
        if (!contentBytes) {
          errors.push(`No content for ${attachment.name}`)
          continue
        }

        // Decode base64 to binary
        const buffer = Buffer.from(contentBytes, 'base64')

        // Sanitize filename for storage
        const sanitizedFilename = attachment.name.replace(/[^a-zA-Z0-9._-]/g, '_')
        const timestamp = Date.now()

        // Upload to Supabase Storage
        // Store in emails folder, organized by communication ID
        const storagePath = `emails/${communicationId}/${timestamp}-${sanitizedFilename}`

        const { error: uploadError } = await supabase.storage
          .from('custom-ops-files')
          .upload(storagePath, buffer, {
            contentType: attachment.contentType,
            cacheControl: '3600',
          })

        if (uploadError) {
          console.error(`[Email Attachments] Upload error for ${attachment.name}:`, uploadError)
          errors.push(`Failed to upload ${attachment.name}: ${uploadError.message}`)
          continue
        }

        // Create file record in database
        const fileRecord = {
          work_item_id: workItemId,
          communication_id: communicationId,
          kind: 'email_attachment' as const,
          version: 1,
          original_filename: attachment.name,
          normalized_filename: sanitizedFilename,
          storage_bucket: 'custom-ops-files',
          storage_path: storagePath,
          mime_type: attachment.contentType,
          size_bytes: attachment.size,
          uploaded_by_user_id: null, // System upload
          note: `Auto-downloaded from email`,
        }

        const { error: dbError } = await supabase
          .from('files')
          .insert(fileRecord)

        if (dbError) {
          console.error(`[Email Attachments] DB error for ${attachment.name}:`, dbError)
          errors.push(`Failed to save ${attachment.name} to database: ${dbError.message}`)

          // Clean up the uploaded file
          await supabase.storage
            .from('custom-ops-files')
            .remove([storagePath])
          continue
        }

        downloadedCount++
        console.log(`[Email Attachments] Successfully saved: ${attachment.name}`)

      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error'
        console.error(`[Email Attachments] Error downloading ${attachment.name}:`, error)
        errors.push(`${attachment.name}: ${errorMessage}`)
      }
    }

    const success = errors.length === 0
    console.log(`[Email Attachments] Download complete: ${downloadedCount}/${downloadableAttachments.length} successful`)

    return {
      success,
      downloadedCount,
      errors
    }

  } catch (error) {
    console.error('[Email Attachments] Unexpected error:', error)
    return {
      success: false,
      downloadedCount,
      errors: [error instanceof Error ? error.message : 'Unknown error']
    }
  }
}
