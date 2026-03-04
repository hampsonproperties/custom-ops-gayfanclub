import { NextResponse } from 'next/server'
import { Client } from '@microsoft/microsoft-graph-client'
import { ClientSecretCredential } from '@azure/identity'
import 'isomorphic-fetch'
import { importEmail, isJunkEmail } from '@/lib/utils/email-import'
import { addToDLQ } from '@/lib/utils/dead-letter-queue'
import { unauthorized, serverError } from '@/lib/api/errors'
import { logger } from '@/lib/logger'
import { EMAIL_CRON_LOOKBACK_MINUTES } from '@/lib/config'

const log = logger('cron-import-emails')

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

/**
 * Cron job to poll for new emails every 15 minutes
 * This acts as a backup to the webhook system, which can be unreliable
 *
 * Security: Requires CRON_SECRET authorization header
 */
export async function GET(request: Request) {
  try {
    // Verify authorization
    const authHeader = request.headers.get('authorization')
    const cronSecret = process.env.CRON_SECRET

    if (!cronSecret) {
      log.error('CRON_SECRET not configured')
      return serverError('Cron secret not configured')
    }

    if (authHeader !== `Bearer ${cronSecret}`) {
      log.error('Unauthorized cron request')
      return unauthorized('Unauthorized')
    }

    const mailboxEmail = process.env.MICROSOFT_MAILBOX_EMAIL || 'sales@thegayfanclub.com'
    const client = getGraphClient()

    // Fetch emails from the last 30 minutes (with some overlap for safety)
    const lookbackMinutes = EMAIL_CRON_LOOKBACK_MINUTES
    const dateFilter = new Date(Date.now() - lookbackMinutes * 60 * 1000)
    const dateFilterISO = dateFilter.toISOString()

    log.info('Checking for emails', { since: dateFilterISO })

    const messages = await client
      .api(`/users/${mailboxEmail}/messages`)
      .select(
        'id,internetMessageId,subject,from,toRecipients,body,receivedDateTime,sentDateTime,conversationId'
      )
      .filter(`receivedDateTime ge ${dateFilterISO}`)
      .top(50)
      .orderby('receivedDateTime desc')
      .get()

    log.info('Found emails', { count: messages.value.length })

    let imported = 0
    let skipped = 0
    let filtered = 0

    for (const message of messages.value) {
      const fromEmail = message.from?.emailAddress?.address || 'unknown@unknown.com'
      const subject = message.subject || ''

      // Skip junk emails (form submissions are exempt)
      if (isJunkEmail(fromEmail, subject)) {
        filtered++
        continue
      }

      // Use shared import function (handles deduplication automatically)
      const result = await importEmail(message, { mailboxEmail })

      if (result.success) {
        if (result.action === 'inserted') {
          imported++
          log.info('Imported email', { subject: message.subject })
        } else if (result.action === 'duplicate') {
          skipped++
        }
      } else {
        log.error('Failed to import email', { error: result.error })
      }
    }

    log.info('Email import complete', { imported, skipped, filtered })

    return NextResponse.json({
      success: true,
      imported,
      skipped,
      filtered,
      total: messages.value.length,
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    log.error('Email import cron error', { error })

    // Add to DLQ for retry (critical cron job failure)
    await addToDLQ({
      operationType: 'email_import',
      operationKey: `cron:${new Date().toISOString()}`,
      errorMessage: error instanceof Error ? error.message : 'Failed to import emails',
      errorStack: error instanceof Error ? error.stack : undefined,
      operationPayload: {
        mailboxEmail: process.env.MICROSOFT_MAILBOX_EMAIL,
        cronTimestamp: new Date().toISOString(),
      },
    }).catch((dlqError) => {
      log.error('Failed to add to DLQ', { error: dlqError })
    })

    return serverError(error instanceof Error ? error.message : 'Failed to import emails')
  }
}
