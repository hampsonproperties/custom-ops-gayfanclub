import { NextRequest, NextResponse } from 'next/server'
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

export async function POST(request: NextRequest) {
  try {
    const { limit = 100, daysBack = 60 } = await request.json()
    const mailboxEmail = process.env.MICROSOFT_MAILBOX_EMAIL || 'sales@thegayfanclub.com'

    const client = getGraphClient()

    // Calculate date filter (emails received after this date)
    const dateFilter = new Date()
    dateFilter.setDate(dateFilter.getDate() - daysBack)
    const dateFilterISO = dateFilter.toISOString()

    // Fetch recent emails with date filter
    const messages = await client
      .api(`/users/${mailboxEmail}/messages`)
      .select(
        'id,internetMessageId,subject,from,toRecipients,body,receivedDateTime,sentDateTime,conversationId'
      )
      .filter(`receivedDateTime ge ${dateFilterISO}`)
      .top(limit)
      .orderby('receivedDateTime desc')
      .get()

    console.log(`[Email Import] Fetched ${messages.value.length} emails from mailbox`)

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
        console.log(`[Email Import] Filtered junk email from: ${fromEmail}`)
        continue
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
        console.error(`[Email Import] Failed to import: ${result.error}`)
        // Continue with next email even if one fails
      }
    }

    console.log(`[Email Import] Complete: ${imported} imported, ${skipped} duplicates, ${filtered} junk`)

    return NextResponse.json({
      success: true,
      imported,
      skipped,
      filtered,
      total: messages.value.length,
    })
  } catch (error) {
    console.error('[Email Import] Error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to import emails' },
      { status: 500 }
    )
  }
}
