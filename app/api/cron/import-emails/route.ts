import { NextResponse } from 'next/server'
import { Client } from '@microsoft/microsoft-graph-client'
import { ClientSecretCredential } from '@azure/identity'
import 'isomorphic-fetch'
import { importEmail, isJunkEmail } from '@/lib/utils/email-import'

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
      console.error('CRON_SECRET not configured')
      return NextResponse.json(
        { error: 'Cron secret not configured' },
        { status: 500 }
      )
    }

    if (authHeader !== `Bearer ${cronSecret}`) {
      console.error('Unauthorized cron request')
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const mailboxEmail = process.env.MICROSOFT_MAILBOX_EMAIL || 'sales@thegayfanclub.com'
    const client = getGraphClient()

    // Fetch emails from the last 30 minutes (with some overlap for safety)
    const lookbackMinutes = 30
    const dateFilter = new Date(Date.now() - lookbackMinutes * 60 * 1000)
    const dateFilterISO = dateFilter.toISOString()

    console.log(`[Email Cron] Checking for emails since ${dateFilterISO}`)

    const messages = await client
      .api(`/users/${mailboxEmail}/messages`)
      .select(
        'id,internetMessageId,subject,from,toRecipients,body,receivedDateTime,sentDateTime,conversationId'
      )
      .filter(`receivedDateTime ge ${dateFilterISO}`)
      .top(50)
      .orderby('receivedDateTime desc')
      .get()

    console.log(`[Email Cron] Found ${messages.value.length} emails`)

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
          console.log(`[Email Cron] Imported: ${message.subject}`)
        } else if (result.action === 'duplicate') {
          skipped++
        }
      } else {
        console.error(`[Email Cron] Failed to import: ${result.error}`)
      }
    }

    console.log(
      `[Email Cron] Complete: ${imported} imported, ${skipped} duplicates, ${filtered} junk`
    )

    return NextResponse.json({
      success: true,
      imported,
      skipped,
      filtered,
      total: messages.value.length,
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    console.error('[Email Cron] Error:', error)
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Failed to import emails',
      },
      { status: 500 }
    )
  }
}
