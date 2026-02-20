/**
 * Order Number Extraction Utility
 *
 * Extracts order numbers from email subject lines and bodies
 * to improve auto-linking of emails to work items.
 *
 * Handles various formats:
 * - Order #1234
 * - Order 1234
 * - #1234
 * - Ref: 1234
 * - etc.
 */

export interface OrderNumberMatch {
  orderNumber: string
  source: 'subject' | 'body'
  confidence: 'high' | 'medium' | 'low'
  pattern: string
}

/**
 * Extract order numbers from email subject and body
 */
export function extractOrderNumbers(
  subject: string,
  body: string
): OrderNumberMatch[] {
  const matches: OrderNumberMatch[] = []
  const seen = new Set<string>()

  // Pattern 1: "Order #1234" or "Order 1234" (high confidence)
  const orderHashPattern = /\bOrder\s*#?\s*(\d{3,6})\b/gi
  extractWithPattern(
    orderHashPattern,
    subject,
    'subject',
    'high',
    'Order #XXXX',
    matches,
    seen
  )
  extractWithPattern(
    orderHashPattern,
    body,
    'body',
    'high',
    'Order #XXXX',
    matches,
    seen
  )

  // Pattern 2: Just "#1234" at beginning or after space (medium confidence)
  const hashPattern = /(?:^|\s)#(\d{3,6})\b/g
  extractWithPattern(
    hashPattern,
    subject,
    'subject',
    'medium',
    '#XXXX',
    matches,
    seen
  )
  extractWithPattern(hashPattern, body, 'body', 'low', '#XXXX', matches, seen)

  // Pattern 3: "Ref: 1234" or "Reference: 1234" (medium confidence)
  const refPattern = /\b(?:Ref|Reference):\s*(\d{3,6})\b/gi
  extractWithPattern(
    refPattern,
    subject,
    'subject',
    'medium',
    'Ref: XXXX',
    matches,
    seen
  )
  extractWithPattern(
    refPattern,
    body,
    'body',
    'low',
    'Ref: XXXX',
    matches,
    seen
  )

  // Pattern 4: Shopify order format "Order #SO-1234-ABC" (high confidence)
  const shopifyPattern = /\bOrder\s*#?\s*([A-Z]{2}-\d{3,6}-[A-Z]{3})\b/gi
  extractWithPattern(
    shopifyPattern,
    subject,
    'subject',
    'high',
    'Order #SO-XXXX-ABC',
    matches,
    seen
  )
  extractWithPattern(
    shopifyPattern,
    body,
    'body',
    'high',
    'Order #SO-XXXX-ABC',
    matches,
    seen
  )

  // Pattern 5: "Re: CLACK FAN DESIGN" - Extract from subject as title match (low confidence)
  // This is handled separately in the linking logic

  return matches
}

function extractWithPattern(
  pattern: RegExp,
  text: string,
  source: 'subject' | 'body',
  confidence: 'high' | 'medium' | 'low',
  patternName: string,
  matches: OrderNumberMatch[],
  seen: Set<string>
): void {
  const regex = new RegExp(pattern)
  let match

  while ((match = regex.exec(text)) !== null) {
    const orderNumber = match[1]

    // Avoid duplicates
    const key = `${orderNumber}-${source}`
    if (seen.has(key)) continue
    seen.add(key)

    // Filter out numbers that are too long (likely not order numbers)
    if (orderNumber.length > 6) continue

    matches.push({
      orderNumber,
      source,
      confidence,
      pattern: patternName,
    })
  }
}

/**
 * Find work item by order number
 * Searches shopify_order_number and title fields
 */
export async function findWorkItemByOrderNumber(
  supabase: any,
  orderNumber: string
): Promise<string | null> {
  // Try exact match on shopify_order_number
  const { data: exactMatch } = await supabase
    .from('work_items')
    .select('id')
    .eq('shopify_order_number', orderNumber)
    .is('closed_at', null)
    .maybeSingle()

  if (exactMatch) {
    return exactMatch.id
  }

  // Try partial match on shopify_order_number (handles SO-1234-ABC format)
  const { data: partialMatch } = await supabase
    .from('work_items')
    .select('id')
    .ilike('shopify_order_number', `%${orderNumber}%`)
    .is('closed_at', null)
    .limit(1)
    .maybeSingle()

  if (partialMatch) {
    return partialMatch.id
  }

  // Try match in title (for custom orders without Shopify numbers)
  const { data: titleMatch } = await supabase
    .from('work_items')
    .select('id')
    .ilike('title', `%${orderNumber}%`)
    .is('closed_at', null)
    .limit(1)
    .maybeSingle()

  if (titleMatch) {
    return titleMatch.id
  }

  return null
}

/**
 * Enhanced auto-linking that uses order number extraction
 */
export async function autoLinkEmailToWorkItem(
  supabase: any,
  message: {
    id: string
    subject: string | null
    body?: string
    conversationId?: string | null
    from: { emailAddress: { address: string } }
  }
): Promise<string | null> {
  const fromEmail = message.from.emailAddress.address
  const subject = message.subject || ''
  const body = message.body || ''

  // Strategy 1: Thread-based linking (existing)
  if (message.conversationId) {
    const { data: threadEmail } = await supabase
      .from('communications')
      .select('work_item_id')
      .eq('provider_thread_id', message.conversationId)
      .not('work_item_id', 'is', null)
      .limit(1)
      .maybeSingle()

    if (threadEmail?.work_item_id) {
      console.log(
        `[Auto-Link] Linked via thread: ${message.conversationId} → ${threadEmail.work_item_id}`
      )
      return threadEmail.work_item_id
    }
  }

  // Strategy 2: Order number extraction (NEW - high confidence)
  const orderNumbers = extractOrderNumbers(subject, body)

  // Try high confidence matches first
  for (const match of orderNumbers.filter((m) => m.confidence === 'high')) {
    const workItemId = await findWorkItemByOrderNumber(supabase, match.orderNumber)
    if (workItemId) {
      console.log(
        `[Auto-Link] Linked via order number (${match.pattern}): ${match.orderNumber} → ${workItemId}`
      )
      return workItemId
    }
  }

  // Try medium confidence matches
  for (const match of orderNumbers.filter((m) => m.confidence === 'medium')) {
    const workItemId = await findWorkItemByOrderNumber(supabase, match.orderNumber)
    if (workItemId) {
      console.log(
        `[Auto-Link] Linked via order number (${match.pattern}): ${match.orderNumber} → ${workItemId}`
      )
      return workItemId
    }
  }

  // Strategy 3: Email-based linking (existing - 60-day window)
  const lookbackDate = new Date()
  lookbackDate.setDate(lookbackDate.getDate() - 60)

  const { data: recentWorkItem } = await supabase
    .from('work_items')
    .select('id')
    .or(`customer_email.eq.${fromEmail},alternate_emails.cs.{${fromEmail}}`)
    .is('closed_at', null)
    .gte('updated_at', lookbackDate.toISOString())
    .order('updated_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (recentWorkItem) {
    console.log(
      `[Auto-Link] Linked via email match (60-day window): ${fromEmail} → ${recentWorkItem.id}`
    )
    return recentWorkItem.id
  }

  // Strategy 4: Subject title matching (NEW - for "Re: CLACK FAN DESIGN")
  if (subject && subject.length > 10) {
    // Remove "Re:", "Fwd:", etc.
    const cleanSubject = subject.replace(/^(Re|Fwd|RE|FW):\s*/gi, '').trim()

    if (cleanSubject.length > 5) {
      const { data: titleMatch } = await supabase
        .from('work_items')
        .select('id')
        .ilike('title', `%${cleanSubject}%`)
        .is('closed_at', null)
        .limit(1)
        .maybeSingle()

      if (titleMatch) {
        console.log(
          `[Auto-Link] Linked via subject title: "${cleanSubject}" → ${titleMatch.id}`
        )
        return titleMatch.id
      }
    }
  }

  console.log('[Auto-Link] No work item found for email')
  return null
}

/**
 * Suggest new work item creation based on email content
 */
export function shouldCreateWorkItem(
  message: {
    subject: string | null
    body?: string
    from: { emailAddress: { address: string } }
  },
  existingWorkItemFound: boolean
): {
  shouldCreate: boolean
  reason: string
  suggestedTitle: string | null
} {
  // Don't create if already linked
  if (existingWorkItemFound) {
    return {
      shouldCreate: false,
      reason: 'Already linked to existing work item',
      suggestedTitle: null,
    }
  }

  const fromEmail = message.from.emailAddress.address.toLowerCase()
  const subject = (message.subject || '').toLowerCase()
  const body = (message.body || '').toLowerCase()

  // Don't create for auto-replies or notifications
  const autoReplyPatterns = [
    'out of office',
    'automatic reply',
    'away message',
    'vacation',
  ]
  if (autoReplyPatterns.some((pattern) => subject.includes(pattern))) {
    return {
      shouldCreate: false,
      reason: 'Auto-reply detected',
      suggestedTitle: null,
    }
  }

  // Look for inquiry keywords
  const inquiryKeywords = [
    'quote',
    'inquiry',
    'interested in',
    'looking for',
    'custom',
    'order',
    'purchase',
    'bulk',
    'event',
  ]

  const hasInquiryKeyword = inquiryKeywords.some(
    (keyword) => subject.includes(keyword) || body.includes(keyword)
  )

  if (hasInquiryKeyword) {
    return {
      shouldCreate: true,
      reason: 'New inquiry detected',
      suggestedTitle: message.subject || 'Inquiry from ' + fromEmail,
    }
  }

  // Default: don't auto-create (let operator decide)
  return {
    shouldCreate: false,
    reason: 'No clear inquiry detected',
    suggestedTitle: message.subject || 'Email from ' + fromEmail,
  }
}
