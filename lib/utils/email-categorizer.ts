/**
 * Smart email categorization - Gmail-style automatic detection
 * Determines category based on sender, subject, and content patterns
 */

export type EmailCategory = 'primary' | 'promotional' | 'spam' | 'notifications'

interface EmailData {
  from: string
  subject?: string
  body?: string
  htmlBody?: string
}

/**
 * Automatically categorize an email based on smart detection rules
 */
export function autoCategorizEmail(email: EmailData): EmailCategory {
  const from = email.from.toLowerCase()
  const subject = (email.subject || '').toLowerCase()
  const body = (email.body || '').toLowerCase()
  const htmlBody = (email.htmlBody || '').toLowerCase()

  // NOTIFICATIONS - System emails, order updates, shipping
  if (isNotification(from, subject, body)) {
    return 'notifications'
  }

  // PROMOTIONAL - Marketing, newsletters, sales
  if (isPromotional(from, subject, body, htmlBody)) {
    return 'promotional'
  }

  // PRIMARY - Default for customer inquiries and important emails
  return 'primary'
}

/**
 * Detect notification emails (transactional, system-generated)
 */
function isNotification(from: string, subject: string, body: string): boolean {
  // No-reply addresses (system emails)
  if (from.includes('no-reply') || from.includes('noreply') || from.includes('do-not-reply')) {
    return true
  }

  // Known notification systems
  const notificationDomains = [
    '@shopify.com',
    'mailer@shopify.com',
    '@judge.me',
    'support@judge.me',
    '@faire.com',
    'wholesale@info.faire.com',
    '@stripe.com',
    '@paypal.com',
    '@shipstation.com',
    '@notifications.',
    '@alerts.',
  ]

  if (notificationDomains.some(domain => from.includes(domain))) {
    return true
  }

  // Transactional keywords in subject
  const transactionalKeywords = [
    'order #',
    'order confirmation',
    'order placed',
    'order received',
    'tracking',
    'shipped',
    'delivered',
    'invoice',
    'receipt',
    'payment received',
    'payment confirmation',
    'refund',
    'return authorization',
  ]

  if (transactionalKeywords.some(keyword => subject.includes(keyword))) {
    return true
  }

  // Transactional patterns in body
  const transactionalPatterns = [
    'order #',
    'tracking number',
    'shipment notification',
    'your order has',
  ]

  if (transactionalPatterns.some(pattern => body.includes(pattern))) {
    return true
  }

  return false
}

/**
 * Detect promotional emails (marketing, newsletters, sales)
 */
function isPromotional(from: string, subject: string, body: string, htmlBody: string): boolean {
  // Unsubscribe link is the #1 indicator of promotional email
  if (
    htmlBody.includes('unsubscribe') ||
    body.includes('unsubscribe') ||
    htmlBody.includes('opt out') ||
    htmlBody.includes('list-unsubscribe')
  ) {
    return true
  }

  // Known marketing platforms
  const marketingDomains = [
    '@email.etsy.com',
    '@email.',
    '@marketing.',
    '@newsletter.',
    '@promo.',
    '@mail.', // Common bulk email pattern
  ]

  if (marketingDomains.some(domain => from.includes(domain))) {
    return true
  }

  // Marketing keywords in subject
  const marketingKeywords = [
    'sale',
    '% off',
    'percent off',
    'discount',
    'deal',
    'offer',
    'limited time',
    'expires',
    'don\'t miss',
    'last chance',
    'newsletter',
    'new arrivals',
    'just in',
    'trending',
    'shop now',
    'buy now',
    'free shipping',
    'exclusive',
  ]

  const subjectHasMultipleKeywords = marketingKeywords.filter(keyword =>
    subject.includes(keyword)
  ).length >= 1

  if (subjectHasMultipleKeywords) {
    return true
  }

  // Check for marketing patterns
  if (subject.includes('🎁') || subject.includes('🎉') || subject.includes('💰')) {
    return true
  }

  return false
}

/**
 * Get a human-readable explanation for why an email was categorized
 * Useful for debugging and user transparency
 */
export function explainCategorization(email: EmailData): { category: EmailCategory; reason: string } {
  const from = email.from.toLowerCase()
  const subject = (email.subject || '').toLowerCase()
  const body = (email.body || '').toLowerCase()
  const htmlBody = (email.htmlBody || '').toLowerCase()

  // Check notifications first
  if (from.includes('no-reply') || from.includes('noreply')) {
    return { category: 'notifications', reason: 'No-reply sender (system email)' }
  }

  if (from.includes('@shopify.com')) {
    return { category: 'notifications', reason: 'Shopify notification' }
  }

  if (subject.includes('order #') || subject.includes('tracking')) {
    return { category: 'notifications', reason: 'Transactional (order/shipping)' }
  }

  // Check promotional
  if (htmlBody.includes('unsubscribe') || body.includes('unsubscribe')) {
    return { category: 'promotional', reason: 'Contains unsubscribe link' }
  }

  if (from.includes('@email.')) {
    return { category: 'promotional', reason: 'Marketing email domain' }
  }

  if (subject.includes('sale') || subject.includes('discount')) {
    return { category: 'promotional', reason: 'Marketing keywords in subject' }
  }

  // Default to primary
  return { category: 'primary', reason: 'Default (likely customer inquiry)' }
}
