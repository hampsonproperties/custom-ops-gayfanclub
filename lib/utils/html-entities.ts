import { convert } from 'html-to-text'

/**
 * Decode HTML entities to plain text
 * Handles common HTML entities like &nbsp;, &amp;, &lt;, &gt;, &quot;, etc.
 */
export function decodeHtmlEntities(text: string): string {
  const entities: Record<string, string> = {
    '&nbsp;': ' ',
    '&amp;': '&',
    '&lt;': '<',
    '&gt;': '>',
    '&quot;': '"',
    '&#39;': "'",
    '&apos;': "'",
    '&cent;': '¢',
    '&pound;': '£',
    '&yen;': '¥',
    '&euro;': '€',
    '&copy;': '©',
    '&reg;': '®',
  }

  let decoded = text

  // Replace named entities
  for (const [entity, char] of Object.entries(entities)) {
    decoded = decoded.replaceAll(entity, char)
  }

  // Replace numeric entities (&#xxx; and &#xHHH;)
  decoded = decoded.replace(/&#(\d+);/g, (match, dec) =>
    String.fromCharCode(parseInt(dec, 10))
  )
  decoded = decoded.replace(/&#x([0-9a-fA-F]+);/g, (match, hex) =>
    String.fromCharCode(parseInt(hex, 16))
  )

  return decoded
}

/**
 * Strip HTML tags and decode entities to get clean preview text
 * Uses html-to-text library for proper formatting and spacing
 */
export function htmlToPlainText(html: string): string {
  if (!html || html.trim() === '') {
    return ''
  }

  try {
    return convert(html, {
      wordwrap: false,
      preserveNewlines: true,
      selectors: [
        { selector: 'p', format: 'block' },          // Add double newline after paragraphs
        { selector: 'br', format: 'lineBreak' },     // Preserve line breaks
        { selector: 'li', format: 'block' },         // List items on new lines
        { selector: 'div', format: 'block' },        // Divs as blocks
        { selector: 'h1', format: 'block' },         // Headers as blocks
        { selector: 'h2', format: 'block' },
        { selector: 'h3', format: 'block' },
        { selector: 'h4', format: 'block' },
        { selector: 'h5', format: 'block' },
        { selector: 'h6', format: 'block' },
        { selector: 'a', options: { ignoreHref: true } }, // Just show link text, not URLs
        { selector: 'img', format: 'skip' },         // Skip images
        { selector: 'style', format: 'skip' },       // Skip style tags
        { selector: 'script', format: 'skip' },      // Skip script tags
      ],
    }).trim()
  } catch (error) {
    // Fallback to basic stripping if conversion fails
    console.error('Error converting HTML to text:', error)
    const withoutTags = html.replace(/<[^>]*>/g, ' ')
    return decodeHtmlEntities(withoutTags).trim()
  }
}

/**
 * Smart truncate text at sentence or word boundaries
 * Tries to preserve complete sentences when possible
 */
export function smartTruncate(text: string, maxLength: number = 200): string {
  if (!text || text.length <= maxLength) {
    return text
  }

  // Try to truncate at sentence boundary (. ! ?)
  const sentenceEnders = /[.!?]+\s/g
  const sentences: string[] = []
  let match
  let lastIndex = 0

  while ((match = sentenceEnders.exec(text)) !== null) {
    const sentence = text.slice(lastIndex, match.index + match[0].length)
    sentences.push(sentence)
    lastIndex = match.index + match[0].length
  }

  // Add remaining text as incomplete sentence
  if (lastIndex < text.length) {
    sentences.push(text.slice(lastIndex))
  }

  // Build result from complete sentences
  let result = ''
  for (const sentence of sentences) {
    if ((result + sentence).length > maxLength) {
      break
    }
    result += sentence
  }

  // If we got at least one complete sentence, use it
  if (result.trim().length > 0) {
    return result.trim() + (result.length < text.length ? '...' : '')
  }

  // Fallback: truncate at word boundary
  const truncated = text.slice(0, maxLength)
  const lastSpace = truncated.lastIndexOf(' ')

  if (lastSpace > maxLength * 0.8) {
    // Only use word boundary if it's not too far back (within 80% of max length)
    return truncated.slice(0, lastSpace) + '...'
  }

  // Hard truncate if no good word boundary found
  return truncated + '...'
}
