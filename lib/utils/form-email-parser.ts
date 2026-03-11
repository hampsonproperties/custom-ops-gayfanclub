/**
 * Email Body Parser for Form Submissions
 *
 * Extracts structured data from form submission emails (e.g., Powerful Form, Google Forms, etc.)
 * to automatically create work items without manual data entry.
 */

import { logger } from '@/lib/logger'

const log = logger('form-email-parser')

export interface ParsedFormData {
  customerName: string | null
  customerEmail: string | null
  customerPhone: string | null
  organization: string | null
  projectDetails: string | null
  eventDate: string | null
  additionalFields: Record<string, string>
  /** Full form content suitable for notes — all fields formatted as readable text */
  fullFormContent: string | null
}

/**
 * Detects if an email is from a known form provider
 */
export function isFormSubmissionEmail(fromEmail: string, _subject: string): boolean {
  const formProviders = [
    'no-reply@powerfulform.com',
    'noreply@powerfulform.com',
    'forms-noreply@google.com',
    'noreply@formstack.com',
    'notifications@typeform.com',
  ]

  return formProviders.some(provider => fromEmail.toLowerCase().includes(provider.toLowerCase()))
}

/**
 * Maps a key-value pair from a form into the result fields.
 * Returns true if the pair was mapped to a known field.
 */
function mapFieldToResult(
  result: ParsedFormData,
  rawKey: string,
  value: string,
  overwrite: boolean = false
): boolean {
  const key = rawKey.trim().toLowerCase()
  if (!value || value.trim() === '') return false
  const val = value.trim()

  if (key.includes('name') && !key.includes('organization') && !key.includes('company')) {
    if (overwrite || !result.customerName) result.customerName = val
    return true
  }
  if (key.includes('email')) {
    const emailMatch = val.match(/[\w.+-]+@[\w.-]+\.\w+/)
    if (overwrite || !result.customerEmail) result.customerEmail = emailMatch ? emailMatch[0] : val
    return true
  }
  if (key.includes('phone') || key.includes('mobile') || key.includes('cell') || key.includes('contact number') || key.includes('telephone')) {
    if (overwrite || !result.customerPhone) result.customerPhone = val
    return true
  }
  if (key.includes('organization') || key.includes('company') || key.includes('business')) {
    if (overwrite || !result.organization) result.organization = val
    return true
  }
  if (key.includes('project') || key.includes('details') || key.includes('description') || key.includes('message') || key.includes('inquiry') || key.includes('comments')) {
    if (overwrite || !result.projectDetails) result.projectDetails = val
    return true
  }
  if (key.includes('event') && key.includes('date')) {
    if (overwrite || !result.eventDate) result.eventDate = val
    return true
  }
  if (key.includes('date') && !key.includes('update')) {
    if (overwrite || !result.eventDate) result.eventDate = val
    return true
  }

  return false
}

/**
 * Build a readable summary of all parsed form fields for use as notes.
 */
function buildFullFormContent(fields: Array<{ key: string; value: string }>): string {
  return fields
    .filter(f => f.value.trim() !== '')
    .map(f => `${f.key}: ${f.value}`)
    .join('\n')
}

/**
 * Parses Powerful Form email format.
 *
 * Handles multiple formats:
 * - Pattern 1: Asterisk-separated "* Your Name: Amy Baker * Email: ..."
 * - Pattern 2: Line-by-line "Your Name: Amy Baker\nEmail: ..."
 * - Pattern 3: Bold labels "<strong>Your Name:</strong> Amy Baker"
 * - Pattern 4: Fallback email extraction from entire body
 *
 * For project details, captures everything after the field label to avoid truncation.
 */
export function parsePowerfulFormEmail(bodyText: string, bodyHtml: string | null): ParsedFormData | null {
  try {
    // Use plain text if available, otherwise extract from HTML
    const content = bodyText || extractTextFromHtml(bodyHtml || '')

    if (!content || content.trim() === '') {
      log.info('Empty content for form parsing')
      return null
    }

    const result: ParsedFormData = {
      customerName: null,
      customerEmail: null,
      customerPhone: null,
      organization: null,
      projectDetails: null,
      eventDate: null,
      additionalFields: {},
      fullFormContent: null,
    }

    // Collect all key-value pairs for full content
    const allFields: Array<{ key: string; value: string }> = []

    // Pattern 1: Asterisk-separated key-value pairs
    // "Custom Fan Inquiry * Your Name: Amy Baker * Organization: Oregon Country Fair * Email: ..."
    // Only use this pattern if the content actually contains asterisk separators
    const hasAsterisks = content.includes('*')
    const asteriskSegments = hasAsterisks
      ? content.split(/\s*\*\s*/).filter(s => s.trim())
      : []
    let foundAsteriskFields = false

    for (let i = 0; i < asteriskSegments.length; i++) {
      const segment = asteriskSegments[i]
      const colonIdx = segment.indexOf(':')
      if (colonIdx === -1) continue

      const rawKey = segment.substring(0, colonIdx).trim()
      // For the last segment, take everything after the colon (no truncation)
      const rawValue = segment.substring(colonIdx + 1).trim()

      if (!rawKey || !rawValue) continue

      foundAsteriskFields = true
      allFields.push({ key: rawKey, value: rawValue })

      if (!mapFieldToResult(result, rawKey, rawValue)) {
        result.additionalFields[rawKey] = rawValue
      }
    }

    // Pattern 2: Line-by-line format (works when htmlToPlainText preserves newlines)
    // "Your Name: Amy Baker\nOrganization: Oregon Country Fair\nEmail: ..."
    if (!result.customerEmail && !foundAsteriskFields) {
      const lines = content.split('\n').map(l => l.trim()).filter(l => l)
      let collectingDetails = false
      let detailsLines: string[] = []
      let detailsKey = ''

      for (const line of lines) {
        // Check if this is a new key: value pair
        const colonMatch = line.match(/^([^:]{1,50}):\s*(.*)$/)

        if (colonMatch) {
          // If we were collecting multi-line details, save them
          if (collectingDetails && detailsLines.length > 0) {
            const fullDetails = detailsLines.join('\n').trim()
            result.projectDetails = fullDetails
            allFields.push({ key: detailsKey, value: fullDetails })
            collectingDetails = false
            detailsLines = []
          }

          const rawKey = colonMatch[1].trim()
          const rawValue = colonMatch[2].trim()

          if (!rawKey) continue

          const keyLower = rawKey.toLowerCase()
          const isDetailsField = keyLower.includes('project') || keyLower.includes('details') ||
            keyLower.includes('description') || keyLower.includes('message') ||
            keyLower.includes('inquiry') || keyLower.includes('comments')

          if (isDetailsField) {
            // Start collecting multi-line content
            collectingDetails = true
            detailsKey = rawKey
            if (rawValue) detailsLines.push(rawValue)
          } else {
            allFields.push({ key: rawKey, value: rawValue })
            if (!mapFieldToResult(result, rawKey, rawValue)) {
              if (rawValue) result.additionalFields[rawKey] = rawValue
            }
          }
        } else if (collectingDetails) {
          // Continuation of multi-line details field
          detailsLines.push(line)
        }
      }

      // Flush any remaining collected details
      if (collectingDetails && detailsLines.length > 0) {
        const fullDetails = detailsLines.join('\n').trim()
        result.projectDetails = fullDetails
        allFields.push({ key: detailsKey, value: fullDetails })
      }
    }

    // Pattern 3: HTML bold labels — "<strong>Your Name:</strong> Amy Baker" or "<b>Label:</b> Value"
    // Parse from HTML if we still don't have an email and HTML is available
    if (!result.customerEmail && bodyHtml) {
      const boldPattern = /<(?:strong|b)>\s*([^<:]+?):\s*<\/(?:strong|b)>\s*([^<]+)/gi
      let boldMatch
      while ((boldMatch = boldPattern.exec(bodyHtml)) !== null) {
        const rawKey = boldMatch[1].trim()
        const rawValue = boldMatch[2].trim()
        if (!rawKey || !rawValue) continue

        allFields.push({ key: rawKey, value: rawValue })
        if (!mapFieldToResult(result, rawKey, rawValue)) {
          result.additionalFields[rawKey] = rawValue
        }
      }
    }

    // Pattern 4: HTML table rows — <td>Label</td><td>Value</td>
    if (!result.customerEmail && bodyHtml) {
      const tablePattern = /<td[^>]*>\s*([^<:]+?):\s*<\/td>\s*<td[^>]*>\s*([^<]+?)\s*<\/td>/gi
      let tableMatch
      while ((tableMatch = tablePattern.exec(bodyHtml)) !== null) {
        const rawKey = tableMatch[1].trim()
        const rawValue = tableMatch[2].trim()
        if (!rawKey || !rawValue) continue

        allFields.push({ key: rawKey, value: rawValue })
        if (!mapFieldToResult(result, rawKey, rawValue)) {
          result.additionalFields[rawKey] = rawValue
        }
      }
    }

    // Pattern 5: Fallback — extract any email addresses from entire content
    if (!result.customerEmail) {
      const emailMatches = content.match(/[\w.+-]+@[\w.-]+\.\w{2,}/g)
      if (emailMatches && emailMatches.length > 0) {
        const customerEmails = emailMatches.filter(email =>
          !email.includes('powerfulform.com') &&
          !email.includes('shopify.com') &&
          !email.includes('noreply') &&
          !email.includes('no-reply') &&
          !email.includes('thegayfanclub.com')
        )

        if (customerEmails.length > 0) {
          result.customerEmail = customerEmails[0]
        }
      }
    }

    // Build full form content for notes
    if (allFields.length > 0) {
      result.fullFormContent = buildFullFormContent(allFields)
    } else if (content.trim()) {
      // If no structured fields were parsed, use the raw content
      result.fullFormContent = content.trim()
    }

    // If we still have no project details but have content, use the full body
    if (!result.projectDetails && content.trim()) {
      // Strip out lines that look like field labels we already captured
      const contentLines = content.split('\n').filter(line => {
        const trimmed = line.trim()
        if (!trimmed) return false
        // Skip lines that are just a known field
        const colonIdx = trimmed.indexOf(':')
        if (colonIdx > 0 && colonIdx < 50) {
          const key = trimmed.substring(0, colonIdx).toLowerCase()
          if (key.includes('name') || key.includes('email') || key.includes('phone') ||
              key.includes('organization') || key.includes('company') || key.includes('date')) {
            return false
          }
        }
        return true
      })
      if (contentLines.length > 0) {
        result.projectDetails = contentLines.join('\n').trim()
      }
    }

    // Validate that we extracted at least an email
    if (!result.customerEmail) {
      log.info('No customer email found in form content', { contentLength: content.length })
      return null
    }

    return result
  } catch (error) {
    log.error('Error parsing form email', { error })
    return null
  }
}

/**
 * Generic form email parser that tries multiple patterns
 */
export function parseFormEmail(
  fromEmail: string,
  _subject: string,
  bodyText: string,
  bodyHtml: string | null
): ParsedFormData | null {
  // Detect provider and use specific parser
  if (fromEmail.includes('powerfulform.com')) {
    return parsePowerfulFormEmail(bodyText, bodyHtml)
  }

  // Fallback: try generic parsing
  return parsePowerfulFormEmail(bodyText, bodyHtml)
}

/**
 * Extract plain text from HTML (fallback when htmlToPlainText is not available)
 */
function extractTextFromHtml(html: string): string {
  // Remove script and style tags
  let text = html.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
  text = text.replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '')

  // Replace block elements with newlines to preserve structure
  text = text.replace(/<br\s*\/?>/gi, '\n')
  text = text.replace(/<\/p>/gi, '\n')
  text = text.replace(/<\/div>/gi, '\n')
  text = text.replace(/<\/tr>/gi, '\n')
  text = text.replace(/<\/li>/gi, '\n')
  text = text.replace(/<\/h[1-6]>/gi, '\n')

  // Remove all other HTML tags
  text = text.replace(/<[^>]+>/g, ' ')

  // Decode HTML entities
  text = text
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")

  // Normalize runs of whitespace within lines (but preserve newlines)
  text = text.replace(/[^\S\n]+/g, ' ')
  // Collapse multiple blank lines into one
  text = text.replace(/\n{3,}/g, '\n\n')

  return text.trim()
}

/**
 * Determines if parsed form data is sufficient to create a work item
 */
export function isValidFormSubmission(data: ParsedFormData | null): boolean {
  if (!data) return false

  // Must have at least customer email
  if (!data.customerEmail) return false

  // Email validation
  const emailRegex = /^[\w.+-]+@[\w.-]+\.\w{2,}$/
  if (!emailRegex.test(data.customerEmail)) return false

  return true
}
