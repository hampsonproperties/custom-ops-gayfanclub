/**
 * Clean email content for display by removing headers, quote markers, and formatting
 */

export function cleanEmailContent(content: string | null): string {
  if (!content) return ''

  let cleaned = content

  // Remove common email headers (From:, To:, Subject:, Date:, etc.)
  cleaned = cleaned.replace(/^(From|To|Cc|Bcc|Subject|Date|Sent):\s*.+$/gm, '')

  // Remove email quote markers (> at start of line)
  cleaned = cleaned.replace(/^>\s*/gm, '')

  // Remove multiple email signatures
  cleaned = cleaned.replace(/[-_]{2,}\s*(Sent from|Get Outlook|Sent via).*/gi, '')

  // Remove excessive newlines (more than 2 in a row)
  cleaned = cleaned.replace(/\n{3,}/g, '\n\n')

  // Trim whitespace
  cleaned = cleaned.trim()

  return cleaned
}

/**
 * Extract a clean preview from email content
 * Removes headers, quotes, and gets first meaningful paragraph
 */
export function getEmailPreview(content: string | null, maxLength: number = 150): string {
  const cleaned = cleanEmailContent(content)

  // Split into lines and find first meaningful content
  const lines = cleaned.split('\n').filter(line => line.trim().length > 0)

  // Skip lines that look like headers or metadata
  const meaningfulLines = lines.filter(line => {
    const lower = line.toLowerCase().trim()
    return (
      !lower.startsWith('from:') &&
      !lower.startsWith('to:') &&
      !lower.startsWith('subject:') &&
      !lower.startsWith('date:') &&
      !lower.startsWith('sent:') &&
      !lower.match(/^[-_=]{3,}/) && // Separator lines
      line.length > 10 // Skip very short lines
    )
  })

  // Get first meaningful paragraph
  const preview = meaningfulLines.slice(0, 3).join(' ').substring(0, maxLength)

  return preview.trim()
}
