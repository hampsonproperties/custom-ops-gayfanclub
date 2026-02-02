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
 */
export function htmlToPlainText(html: string): string {
  // Strip HTML tags
  const withoutTags = html.replace(/<[^>]*>/g, '')

  // Decode HTML entities
  return decodeHtmlEntities(withoutTags)
}
