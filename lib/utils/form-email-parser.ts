/**
 * Email Body Parser for Form Submissions
 *
 * Extracts structured data from form submission emails (e.g., Powerful Form, Google Forms, etc.)
 * to automatically create work items without manual data entry.
 */

export interface ParsedFormData {
  customerName: string | null
  customerEmail: string | null
  organization: string | null
  projectDetails: string | null
  eventDate: string | null
  additionalFields: Record<string, string>
}

/**
 * Detects if an email is from a known form provider
 */
export function isFormSubmissionEmail(fromEmail: string, subject: string): boolean {
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
 * Parses Powerful Form email format
 *
 * Expected format:
 * "Custom Fan Inquiry Submission * Your Name: Amy Baker * Organization: Oregon Country Fair * Email: amy@threadbarepress.com * Project details: ..."
 */
export function parsePowerfulFormEmail(bodyText: string, bodyHtml: string | null): ParsedFormData | null {
  try {
    // Use plain text if available, otherwise extract from HTML
    const content = bodyText || extractTextFromHtml(bodyHtml || '')

    const result: ParsedFormData = {
      customerName: null,
      customerEmail: null,
      organization: null,
      projectDetails: null,
      eventDate: null,
      additionalFields: {},
    }

    // Pattern 1: Key-value pairs separated by asterisks
    // "Your Name: Amy Baker * Organization: Oregon Country Fair"
    const asteriskPattern = /\*\s*([^:*]+):\s*([^*]+)/g
    let match

    while ((match = asteriskPattern.exec(content)) !== null) {
      const key = match[1].trim().toLowerCase()
      const value = match[2].trim()

      if (!value || value === '') continue

      // Map common field names to standard fields
      if (key.includes('name') && !key.includes('organization')) {
        result.customerName = value
      } else if (key.includes('email')) {
        // Extract email address if it's in "Name <email>" format
        const emailMatch = value.match(/[\w.+-]+@[\w.-]+\.\w+/)
        result.customerEmail = emailMatch ? emailMatch[0] : value
      } else if (key.includes('organization') || key.includes('company')) {
        result.organization = value
      } else if (key.includes('project') || key.includes('details') || key.includes('description')) {
        result.projectDetails = value
      } else if (key.includes('event date') || key.includes('date')) {
        result.eventDate = value
      } else {
        // Store additional fields
        result.additionalFields[match[1].trim()] = value
      }
    }

    // Pattern 2: Line-by-line format
    // "Your Name: Amy Baker\nOrganization: Oregon Country Fair"
    if (!result.customerEmail) {
      const lines = content.split('\n')

      for (const line of lines) {
        const colonMatch = line.match(/^([^:]+):\s*(.+)$/)
        if (!colonMatch) continue

        const key = colonMatch[1].trim().toLowerCase()
        const value = colonMatch[2].trim()

        if (!value || value === '') continue

        if (key.includes('name') && !key.includes('organization') && !result.customerName) {
          result.customerName = value
        } else if (key.includes('email') && !result.customerEmail) {
          const emailMatch = value.match(/[\w.+-]+@[\w.-]+\.\w+/)
          result.customerEmail = emailMatch ? emailMatch[0] : value
        } else if ((key.includes('organization') || key.includes('company')) && !result.organization) {
          result.organization = value
        } else if ((key.includes('project') || key.includes('details') || key.includes('description')) && !result.projectDetails) {
          result.projectDetails = value
        } else if ((key.includes('event date') || key.includes('date')) && !result.eventDate) {
          result.eventDate = value
        }
      }
    }

    // Pattern 3: Extract any email addresses from the entire content as fallback
    if (!result.customerEmail) {
      // Find all email addresses in content
      const emailMatches = content.match(/[\w.+-]+@[\w.-]+\.\w{2,}/g)
      if (emailMatches && emailMatches.length > 0) {
        // Filter out form provider emails
        const customerEmails = emailMatches.filter(email =>
          !email.includes('powerfulform.com') &&
          !email.includes('shopify.com') &&
          !email.includes('noreply') &&
          !email.includes('no-reply')
        )

        if (customerEmails.length > 0) {
          result.customerEmail = customerEmails[0]
        }
      }
    }

    // Validate that we extracted at least an email
    if (!result.customerEmail) {
      return null
    }

    return result
  } catch (error) {
    console.error('[parsePowerfulFormEmail] Error parsing form email:', error)
    return null
  }
}

/**
 * Generic form email parser that tries multiple patterns
 */
export function parseFormEmail(
  fromEmail: string,
  subject: string,
  bodyText: string,
  bodyHtml: string | null
): ParsedFormData | null {
  // Detect provider and use specific parser
  if (fromEmail.includes('powerfulform.com')) {
    return parsePowerfulFormEmail(bodyText, bodyHtml)
  }

  // Add more providers here in the future
  // if (fromEmail.includes('google.com') && subject.includes('Form response')) {
  //   return parseGoogleFormEmail(bodyText, bodyHtml)
  // }

  // Fallback: try generic parsing
  return parsePowerfulFormEmail(bodyText, bodyHtml)
}

/**
 * Extract plain text from HTML (simple version)
 */
function extractTextFromHtml(html: string): string {
  // Remove script and style tags
  let text = html.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
  text = text.replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '')

  // Replace <br> and </p> with newlines
  text = text.replace(/<br\s*\/?>/gi, '\n')
  text = text.replace(/<\/p>/gi, '\n')

  // Remove all other HTML tags
  text = text.replace(/<[^>]+>/g, '')

  // Decode HTML entities
  text = text
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")

  // Normalize whitespace
  text = text.replace(/\s+/g, ' ').trim()

  return text
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
