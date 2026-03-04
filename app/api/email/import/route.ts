import { NextRequest, NextResponse } from 'next/server'
import { Client } from '@microsoft/microsoft-graph-client'
import { ClientSecretCredential } from '@azure/identity'
import 'isomorphic-fetch'
import { importEmail, isJunkEmail } from '@/lib/utils/email-import'
import { logger } from '@/lib/logger'
import { serverError } from '@/lib/api/errors'

const log = logger('email-import')

function getGraphClient() {
  const credential = new ClientSecretCredential(
    process.env.MICROSOFT_TENANT_ID!,
    process.env.MICROSOFT_CLIENT_ID!,
    process.env.MICROSOFT_CLIENT_SECRET!
  )

  return Client.initWithMiddleware({
    authProvider: {
      getAccessToken: async () => {
        const token = await credential.getToken('https://graph.microsoft.com/.default')
        return token.token
      },
    },
  })
}

export async function POST(request: NextRequest) {
  try {
    const { validateBody } = await import('@/lib/api/validate')
    const { importEmailsBody } = await import('@/lib/api/schemas')
    const bodyResult = validateBody(await request.json(), importEmailsBody)
    if (bodyResult.error) return bodyResult.error
    const { limit = 100, daysBack = 60 } = bodyResult.data
    const mailboxEmail = process.env.MICROSOFT_MAILBOX_EMAIL || 'sales@thegayfanclub.com'

    const client = getGraphClient()

    // Calculate date filter (emails received after this date)
    const dateFilter = new Date()
    dateFilter.setDate(dateFilter.getDate() - daysBack)
    const dateFilterISO = dateFilter.toISOString()

    // Fetch recent emails with date filter (including attachments flag)
    const messages = await client
      .api(`/users/${mailboxEmail}/messages`)
      .select(
        'id,internetMessageId,subject,from,toRecipients,body,receivedDateTime,sentDateTime,conversationId,hasAttachments'
      )
      .filter(`receivedDateTime ge ${dateFilterISO}`)
      .top(limit)
      .orderby('receivedDateTime desc')
      .get()

    log.info('Fetched emails from mailbox', { count: messages.value.length })

    let imported = 0
    let skipped = 0
    let filtered = 0

    for (const message of messages.value) {
      // Extract sender email early for filtering
      const fromEmail = message.from?.emailAddress?.address || 'unknown@unknown.com'
      const subject = message.subject || ''

      // Skip obvious junk emails (form submissions are exempt)
      if (isJunkEmail(fromEmail, subject)) {
        filtered++
        log.info('Filtered junk email', { fromEmail })
        continue
      }

      // Fetch attachment metadata if email has attachments
      if (message.hasAttachments) {
        try {
          const attachments = await client
            .api(`/users/${mailboxEmail}/messages/${message.id}/attachments`)
            .select('id,name,contentType,size,isInline')
            .get()

          message.attachments = attachments.value || []
          log.info('Fetched attachments for message', { count: message.attachments.length, subject })
        } catch (err) {
          log.error('Failed to fetch attachments', { error: err, messageId: message.id })
          message.attachments = []
        }
      }

      // Use shared import function (handles deduplication, categorization, auto-linking)
      const result = await importEmail(message, { mailboxEmail })

      if (result.success) {
        if (result.action === 'inserted') {
          imported++
        } else if (result.action === 'duplicate') {
          skipped++
        }
      } else {
        log.error('Failed to import email', { error: result.error })
        // Continue with next email even if one fails
      }
    }

    log.info('Import complete', { imported, skipped: skipped, filtered })

    return NextResponse.json({
      success: true,
      imported,
      skipped,
      filtered,
      total: messages.value.length,
    })
  } catch (error) {
    log.error('Error during email import', { error })
    return serverError(error instanceof Error ? error.message : 'Failed to import emails')
  }
}
