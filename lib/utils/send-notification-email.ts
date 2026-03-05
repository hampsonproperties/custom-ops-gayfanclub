import { Client } from '@microsoft/microsoft-graph-client'
import { ClientSecretCredential } from '@azure/identity'
import 'isomorphic-fetch'
import { logger } from '@/lib/logger'
import { formatDistanceToNow } from 'date-fns'

const log = logger('notification-email')

interface EmailAlert {
  subject: string
  from_email: string
  received_at: string
}

interface SendNotificationEmailParams {
  toEmail: string
  toName: string | null
  emails: EmailAlert[]
}

/**
 * Send a high-priority email notification to a team member.
 * Uses Microsoft Graph (same pattern as app/api/email/send/route.ts).
 */
export async function sendNotificationEmail({ toEmail, toName, emails }: SendNotificationEmailParams) {
  if (emails.length === 0) return

  const credential = new ClientSecretCredential(
    process.env.MICROSOFT_TENANT_ID!,
    process.env.MICROSOFT_CLIENT_ID!,
    process.env.MICROSOFT_CLIENT_SECRET!,
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
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://custom-ops-gayfanclub.vercel.app'
  const greeting = toName ? `Hi ${toName.split(' ')[0]}` : 'Hi'

  const emailRows = emails.map(e => {
    const waitTime = formatDistanceToNow(new Date(e.received_at), { addSuffix: false })
    return `<tr>
      <td style="padding:8px 12px;border-bottom:1px solid #eee;">${escapeHtml(e.subject || '(no subject)')}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #eee;">${escapeHtml(e.from_email)}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #eee;">${waitTime} ago</td>
    </tr>`
  }).join('')

  const subject = emails.length === 1
    ? `Action needed: "${emails[0].subject || '(no subject)'}" is waiting for your reply`
    : `Action needed: ${emails.length} emails are waiting for your reply`

  const html = `
    <div style="font-family:system-ui,sans-serif;max-width:600px;margin:0 auto;">
      <p>${greeting},</p>
      <p>You have <strong>${emails.length}</strong> high-priority email${emails.length > 1 ? 's' : ''} waiting for your reply:</p>
      <table style="width:100%;border-collapse:collapse;margin:16px 0;">
        <thead>
          <tr style="background:#f5f5f5;">
            <th style="padding:8px 12px;text-align:left;">Subject</th>
            <th style="padding:8px 12px;text-align:left;">From</th>
            <th style="padding:8px 12px;text-align:left;">Waiting</th>
          </tr>
        </thead>
        <tbody>${emailRows}</tbody>
      </table>
      <p><a href="${appUrl}/inbox/my-inbox" style="display:inline-block;padding:10px 20px;background:#18181b;color:#fff;text-decoration:none;border-radius:6px;">Open My Inbox</a></p>
      <p style="color:#888;font-size:12px;margin-top:24px;">This is an automated alert from Gay Fan Club Custom Ops.</p>
    </div>
  `

  try {
    await client
      .api(`/users/${mailboxEmail}/sendMail`)
      .post({
        message: {
          subject,
          body: { contentType: 'HTML', content: html },
          toRecipients: [{ emailAddress: { address: toEmail } }],
        },
        saveToSentItems: false,
      })

    log.info('Notification email sent', { toEmail, emailCount: emails.length })
  } catch (error) {
    log.error('Failed to send notification email', { error, toEmail })
    throw error
  }
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}
