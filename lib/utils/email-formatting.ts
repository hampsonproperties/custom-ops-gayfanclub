/**
 * Utility functions for formatting email addresses and content
 * to display like modern email clients (Gmail, Outlook, etc.)
 */

export interface ParsedEmailAddress {
  name: string | null
  email: string
  displayName: string
}

/**
 * Parse an email address in various formats:
 * - "John Doe <john@example.com>"
 * - "john@example.com"
 * - "<john@example.com>"
 */
export function parseEmailAddress(emailString: string): ParsedEmailAddress {
  if (!emailString) {
    return { name: null, email: '', displayName: '' }
  }

  const trimmed = emailString.trim()

  // Match "Name <email@domain.com>" format
  const nameEmailMatch = trimmed.match(/^(.+?)\s*<([^>]+)>$/)
  if (nameEmailMatch) {
    const name = nameEmailMatch[1].trim().replace(/^["']|["']$/g, '') // Remove quotes
    const email = nameEmailMatch[2].trim()
    return {
      name,
      email,
      displayName: name || email,
    }
  }

  // Match "<email@domain.com>" format
  const emailOnlyMatch = trimmed.match(/^<([^>]+)>$/)
  if (emailOnlyMatch) {
    const email = emailOnlyMatch[1].trim()
    return {
      name: null,
      email,
      displayName: email,
    }
  }

  // Plain email address
  return {
    name: null,
    email: trimmed,
    displayName: trimmed,
  }
}

/**
 * Format a single email address for display
 */
export function formatEmailAddress(
  emailString: string,
  options: { showEmail?: boolean; short?: boolean } = {}
): string {
  const { showEmail = false, short = false } = options
  const parsed = parseEmailAddress(emailString)

  if (!parsed.email) return ''

  if (short && parsed.name) {
    return parsed.name
  }

  if (parsed.name && showEmail) {
    return `${parsed.name} <${parsed.email}>`
  }

  return parsed.displayName
}

/**
 * Format multiple email addresses for display
 * Returns formatted list with optional truncation
 */
export function formatEmailList(
  emails: string | string[],
  options: { maxDisplay?: number; showEmail?: boolean } = {}
): { displayText: string; totalCount: number; hasMore: boolean } {
  const { maxDisplay = 3, showEmail = false } = options

  const emailArray = Array.isArray(emails) ? emails : [emails]
  const parsed = emailArray.map((e) => parseEmailAddress(e))

  const displayEmails = parsed.slice(0, maxDisplay)
  const remaining = parsed.length - maxDisplay

  const displayText = displayEmails
    .map((p) => (p.name && !showEmail ? p.name : p.displayName))
    .join(', ')

  return {
    displayText: remaining > 0 ? `${displayText} +${remaining} more` : displayText,
    totalCount: parsed.length,
    hasMore: remaining > 0,
  }
}

/**
 * Extract plain text preview from HTML email
 * Strips HTML tags and cleans up formatting
 */
export function extractEmailPreview(
  html: string | null,
  plainText: string | null,
  maxLength: number = 200
): string {
  let text = plainText || html || ''

  if (html && !plainText) {
    // Strip HTML tags and decode entities
    text = html
      .replace(/<style[^>]*>.*?<\/style>/gis, '')
      .replace(/<script[^>]*>.*?<\/script>/gis, '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
  }

  // Clean up whitespace
  text = text
    .replace(/\s+/g, ' ')
    .replace(/\n+/g, ' ')
    .trim()

  if (text.length > maxLength) {
    return text.substring(0, maxLength).trim() + '...'
  }

  return text
}

/**
 * Detect and collapse quoted email content
 * Returns { body: string, hasQuoted: boolean, quotedContent: string }
 */
export function separateQuotedContent(html: string): {
  body: string
  hasQuoted: boolean
  quotedContent: string
} {
  // Common quoted email patterns
  const quotedPatterns = [
    /<div class="gmail_quote">/i,
    /<blockquote/i,
    /On .+ wrote:/i,
    /From: .+\nSent: .+\nTo: .+\nSubject:/i,
    /_{5,}/,
    /^>.+/m,
  ]

  for (const pattern of quotedPatterns) {
    const match = html.match(pattern)
    if (match && match.index !== undefined) {
      return {
        body: html.substring(0, match.index).trim(),
        hasQuoted: true,
        quotedContent: html.substring(match.index).trim(),
      }
    }
  }

  return {
    body: html,
    hasQuoted: false,
    quotedContent: '',
  }
}

/**
 * Clean up email HTML for better display
 * Removes inline styles that conflict with our design
 */
export function cleanEmailHTML(html: string): string {
  if (!html) return ''

  return (
    html
      // Remove potentially conflicting inline styles
      .replace(/style="[^"]*"/gi, '')
      .replace(/class="[^"]*"/gi, '')
      // Remove empty paragraphs and divs
      .replace(/<p>\s*<\/p>/gi, '')
      .replace(/<div>\s*<\/div>/gi, '')
      // Normalize whitespace
      .replace(/\s+/g, ' ')
      .trim()
  )
}

/**
 * Format timestamp for email display
 */
export function formatEmailTimestamp(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date
  const now = new Date()
  const diffMs = now.getTime() - d.getTime()
  const diffMins = Math.floor(diffMs / 60000)
  const diffHours = Math.floor(diffMs / 3600000)
  const diffDays = Math.floor(diffMs / 86400000)

  if (diffMins < 1) return 'Just now'
  if (diffMins < 60) return `${diffMins}m ago`
  if (diffHours < 24) return `${diffHours}h ago`
  if (diffDays < 7) return `${diffDays}d ago`

  // Show date
  const month = d.toLocaleDateString('en-US', { month: 'short' })
  const day = d.getDate()
  const year = d.getFullYear()

  if (year === now.getFullYear()) {
    return `${month} ${day}`
  }

  return `${month} ${day}, ${year}`
}
