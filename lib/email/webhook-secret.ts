/**
 * HMAC-signed clientState for Microsoft Graph email webhook
 *
 * Instead of a hardcoded string, we derive the clientState from
 * a secret env var using HMAC-SHA256. This means:
 *  - The value isn't guessable from source code
 *  - Validation uses timing-safe comparison (no timing attacks)
 *  - Rotating the secret is just changing an env var
 */

import { createHmac, timingSafeEqual } from 'crypto'

const SIGN_MESSAGE = 'ms-graph-email-webhook'

/**
 * Generate the clientState value to send to Microsoft when creating a subscription.
 * Returns an HMAC-SHA256 hex digest derived from EMAIL_WEBHOOK_SECRET.
 */
export function generateWebhookClientState(): string {
  const secret = process.env.EMAIL_WEBHOOK_SECRET
  if (!secret) {
    throw new Error('EMAIL_WEBHOOK_SECRET environment variable is not set')
  }

  return createHmac('sha256', secret).update(SIGN_MESSAGE).digest('hex')
}

/**
 * Verify that an incoming clientState from Microsoft matches our expected HMAC.
 * Uses timing-safe comparison to prevent timing attacks.
 */
export function verifyWebhookClientState(received: string | undefined): boolean {
  if (!received) return false

  const secret = process.env.EMAIL_WEBHOOK_SECRET
  if (!secret) return false

  const expected = createHmac('sha256', secret).update(SIGN_MESSAGE).digest('hex')

  // Both are hex strings, so same length if valid
  if (received.length !== expected.length) return false

  return timingSafeEqual(Buffer.from(received), Buffer.from(expected))
}
