/**
 * Email Webhook HMAC Secret Tests
 *
 * Tests the HMAC-SHA256 clientState generation and verification
 * used by the Microsoft Graph email webhook.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { generateWebhookClientState, verifyWebhookClientState } from '../webhook-secret'
import { createHmac } from 'crypto'

const TEST_SECRET = 'test-secret-key-for-unit-tests-1234567890abcdef'
const DIFFERENT_SECRET = 'completely-different-secret-xyz'

beforeEach(() => {
  vi.stubEnv('EMAIL_WEBHOOK_SECRET', TEST_SECRET)
})

afterEach(() => {
  vi.unstubAllEnvs()
})

// ---------------------------------------------------------------------------
// generateWebhookClientState
// ---------------------------------------------------------------------------

describe('generateWebhookClientState', () => {
  it('returns a 64-character hex string (SHA-256 digest)', () => {
    const result = generateWebhookClientState()
    expect(result).toMatch(/^[0-9a-f]{64}$/)
  })

  it('returns deterministic output for the same secret', () => {
    const first = generateWebhookClientState()
    const second = generateWebhookClientState()
    expect(first).toBe(second)
  })

  it('matches manually computed HMAC-SHA256', () => {
    const expected = createHmac('sha256', TEST_SECRET)
      .update('ms-graph-email-webhook')
      .digest('hex')
    expect(generateWebhookClientState()).toBe(expected)
  })

  it('throws when EMAIL_WEBHOOK_SECRET is not set', () => {
    vi.stubEnv('EMAIL_WEBHOOK_SECRET', '')
    // Empty string is falsy, should throw
    expect(() => generateWebhookClientState()).toThrow('EMAIL_WEBHOOK_SECRET')
  })

  it('throws when EMAIL_WEBHOOK_SECRET is undefined', () => {
    delete process.env.EMAIL_WEBHOOK_SECRET
    expect(() => generateWebhookClientState()).toThrow('EMAIL_WEBHOOK_SECRET')
  })

  it('produces different output for different secrets', () => {
    const first = generateWebhookClientState()

    vi.stubEnv('EMAIL_WEBHOOK_SECRET', DIFFERENT_SECRET)
    const second = generateWebhookClientState()

    expect(first).not.toBe(second)
  })
})

// ---------------------------------------------------------------------------
// verifyWebhookClientState
// ---------------------------------------------------------------------------

describe('verifyWebhookClientState', () => {
  it('returns true for a valid clientState', () => {
    const clientState = generateWebhookClientState()
    expect(verifyWebhookClientState(clientState)).toBe(true)
  })

  it('returns false for an invalid clientState', () => {
    expect(verifyWebhookClientState('invalid-garbage-string')).toBe(false)
  })

  it('returns false for undefined', () => {
    expect(verifyWebhookClientState(undefined)).toBe(false)
  })

  it('returns false for empty string', () => {
    expect(verifyWebhookClientState('')).toBe(false)
  })

  it('returns false for the old hardcoded string', () => {
    // The whole point of this upgrade — the old value should NOT pass
    expect(verifyWebhookClientState('customOpsEmailSubscription')).toBe(false)
  })

  it('returns false when secret is not set', () => {
    const clientState = generateWebhookClientState()
    delete process.env.EMAIL_WEBHOOK_SECRET
    expect(verifyWebhookClientState(clientState)).toBe(false)
  })

  it('returns false for a clientState generated with a different secret', () => {
    // Generate with current secret
    const clientState = generateWebhookClientState()

    // Change the secret
    vi.stubEnv('EMAIL_WEBHOOK_SECRET', DIFFERENT_SECRET)

    // Verification should fail because the expected HMAC is now different
    expect(verifyWebhookClientState(clientState)).toBe(false)
  })

  it('returns false for a truncated clientState', () => {
    const clientState = generateWebhookClientState()
    // Remove last character — wrong length should fail
    expect(verifyWebhookClientState(clientState.slice(0, -1))).toBe(false)
  })

  it('returns false for clientState with extra characters', () => {
    const clientState = generateWebhookClientState()
    expect(verifyWebhookClientState(clientState + 'x')).toBe(false)
  })

  it('returns false for a single-bit difference', () => {
    const clientState = generateWebhookClientState()
    // Flip the last hex character
    const lastChar = clientState[clientState.length - 1]
    const flipped = lastChar === '0' ? '1' : '0'
    const tampered = clientState.slice(0, -1) + flipped
    expect(verifyWebhookClientState(tampered)).toBe(false)
  })

  it('is case-sensitive (uppercase hex fails)', () => {
    const clientState = generateWebhookClientState()
    expect(verifyWebhookClientState(clientState.toUpperCase())).toBe(false)
  })
})
