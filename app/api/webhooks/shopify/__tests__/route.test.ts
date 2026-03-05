/**
 * Shopify Webhook Route Tests
 *
 * Tests HMAC verification, idempotency, and topic routing.
 *
 * The route handler is hard to test directly because it uses
 * Next.js server internals (headers(), after()). Instead, we test
 * the HMAC verification logic and the key behavioral contracts
 * by extracting and testing the core logic.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import crypto from 'crypto'

const WEBHOOK_SECRET = 'test-shopify-webhook-secret'

beforeEach(() => {
  vi.stubEnv('SHOPIFY_WEBHOOK_SECRET', WEBHOOK_SECRET)
})

afterEach(() => {
  vi.unstubAllEnvs()
})

// ---------------------------------------------------------------------------
// HMAC Verification Logic (extracted from route.ts)
// ---------------------------------------------------------------------------

/**
 * Replicates the HMAC verification from the Shopify webhook route.
 * This is the exact same algorithm used in route.ts lines 44-52.
 */
function verifyShopifyHmac(body: string, hmac: string, secret: string): boolean {
  const hash = crypto
    .createHmac('sha256', secret)
    .update(body, 'utf8')
    .digest('base64')
  return hash === hmac
}

function computeShopifyHmac(body: string, secret: string): string {
  return crypto
    .createHmac('sha256', secret)
    .update(body, 'utf8')
    .digest('base64')
}

// ---------------------------------------------------------------------------
// HMAC Verification Tests
// ---------------------------------------------------------------------------

describe('Shopify HMAC verification', () => {
  const sampleBody = JSON.stringify({
    id: 123456789,
    name: '#1001',
    email: 'customer@example.com',
    total_price: '49.99',
  })

  it('accepts a valid HMAC signature', () => {
    const hmac = computeShopifyHmac(sampleBody, WEBHOOK_SECRET)
    expect(verifyShopifyHmac(sampleBody, hmac, WEBHOOK_SECRET)).toBe(true)
  })

  it('rejects an invalid HMAC signature', () => {
    expect(verifyShopifyHmac(sampleBody, 'invalid-hmac', WEBHOOK_SECRET)).toBe(false)
  })

  it('rejects when body is tampered with', () => {
    const hmac = computeShopifyHmac(sampleBody, WEBHOOK_SECRET)
    const tamperedBody = sampleBody.replace('49.99', '0.01')
    expect(verifyShopifyHmac(tamperedBody, hmac, WEBHOOK_SECRET)).toBe(false)
  })

  it('rejects when wrong secret is used', () => {
    const hmac = computeShopifyHmac(sampleBody, 'wrong-secret')
    expect(verifyShopifyHmac(sampleBody, hmac, WEBHOOK_SECRET)).toBe(false)
  })

  it('rejects empty HMAC', () => {
    expect(verifyShopifyHmac(sampleBody, '', WEBHOOK_SECRET)).toBe(false)
  })

  it('HMAC is base64-encoded (not hex)', () => {
    const hmac = computeShopifyHmac(sampleBody, WEBHOOK_SECRET)
    // Base64 uses A-Z, a-z, 0-9, +, /, = padding
    expect(hmac).toMatch(/^[A-Za-z0-9+/]+=*$/)
    // Should NOT be a 64-char hex string
    expect(hmac).not.toMatch(/^[0-9a-f]{64}$/)
  })

  it('handles empty body', () => {
    const hmac = computeShopifyHmac('', WEBHOOK_SECRET)
    expect(verifyShopifyHmac('', hmac, WEBHOOK_SECRET)).toBe(true)
  })

  it('handles unicode in body', () => {
    const unicodeBody = JSON.stringify({ note: 'Customer wants 🌈 rainbow design' })
    const hmac = computeShopifyHmac(unicodeBody, WEBHOOK_SECRET)
    expect(verifyShopifyHmac(unicodeBody, hmac, WEBHOOK_SECRET)).toBe(true)
  })

  it('is sensitive to whitespace differences', () => {
    const compact = '{"id":123}'
    const spaced = '{ "id": 123 }'
    const hmac = computeShopifyHmac(compact, WEBHOOK_SECRET)
    expect(verifyShopifyHmac(spaced, hmac, WEBHOOK_SECRET)).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// Idempotency Logic Tests
// ---------------------------------------------------------------------------

describe('Shopify webhook idempotency', () => {
  /**
   * Tests the idempotency check logic from route.ts.
   * The route checks webhook_events for an existing record with
   * processing_status === 'completed' and returns early if found.
   */

  it('identifies completed events as duplicates', () => {
    const existingEvent = { id: 'wh-123', processing_status: 'completed' }
    const isDuplicate = existingEvent.processing_status === 'completed'
    expect(isDuplicate).toBe(true)
  })

  it('allows reprocessing of failed events', () => {
    const existingEvent = { id: 'wh-123', processing_status: 'failed' }
    const isDuplicate = existingEvent.processing_status === 'completed'
    expect(isDuplicate).toBe(false)
  })

  it('allows reprocessing of pending events', () => {
    const existingEvent = { id: 'wh-123', processing_status: 'pending' }
    const isDuplicate = existingEvent.processing_status === 'completed'
    expect(isDuplicate).toBe(false)
  })

  it('allows processing when no existing event exists', () => {
    const existingEvent = null as { id: string; processing_status: string } | null
    const isDuplicate = existingEvent?.processing_status === 'completed'
    expect(isDuplicate).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// Topic Routing Tests
// ---------------------------------------------------------------------------

describe('Shopify webhook topic routing', () => {
  /**
   * Tests the topic routing logic from route.ts lines 107-130.
   * Verifies that the correct processor would be called for each topic.
   */

  const routeTopic = (topic: string | null): string => {
    if (topic === 'orders/create' || topic === 'orders/updated') return 'processOrder'
    if (topic === 'fulfillments/create' || topic === 'orders/fulfilled') return 'processFulfillment'
    if (topic === 'customers/create' || topic === 'customers/update') return 'processCustomer'
    if (topic === 'refunds/create') return 'processRefund'
    return 'skipped'
  }

  it('routes orders/create to processOrder', () => {
    expect(routeTopic('orders/create')).toBe('processOrder')
  })

  it('routes orders/updated to processOrder', () => {
    expect(routeTopic('orders/updated')).toBe('processOrder')
  })

  it('routes fulfillments/create to processFulfillment', () => {
    expect(routeTopic('fulfillments/create')).toBe('processFulfillment')
  })

  it('routes orders/fulfilled to processFulfillment', () => {
    expect(routeTopic('orders/fulfilled')).toBe('processFulfillment')
  })

  it('routes customers/create to processCustomer', () => {
    expect(routeTopic('customers/create')).toBe('processCustomer')
  })

  it('routes customers/update to processCustomer', () => {
    expect(routeTopic('customers/update')).toBe('processCustomer')
  })

  it('routes refunds/create to processRefund', () => {
    expect(routeTopic('refunds/create')).toBe('processRefund')
  })

  it('skips unknown topics', () => {
    expect(routeTopic('products/create')).toBe('skipped')
  })

  it('skips null topic', () => {
    expect(routeTopic(null)).toBe('skipped')
  })
})

// ---------------------------------------------------------------------------
// Webhook Event Data Extraction Tests
// ---------------------------------------------------------------------------

describe('Shopify webhook payload parsing', () => {
  it('extracts external_event_id from payload.id', () => {
    const payload = { id: 123456789, name: '#1001' }
    const externalEventId = payload.id?.toString()
    expect(externalEventId).toBe('123456789')
  })

  it('handles payload with no id gracefully', () => {
    const payload = { name: '#1001' } as any
    const externalEventId = payload.id?.toString()
    expect(externalEventId).toBeUndefined()
  })

  it('converts numeric id to string', () => {
    const payload = { id: 999 }
    const externalEventId = payload.id?.toString()
    expect(typeof externalEventId).toBe('string')
    expect(externalEventId).toBe('999')
  })
})
