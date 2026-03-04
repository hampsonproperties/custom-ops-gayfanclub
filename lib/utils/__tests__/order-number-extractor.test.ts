import { describe, it, expect } from 'vitest'
import { extractOrderNumbers } from '../order-number-extractor'

describe('extractOrderNumbers', () => {
  // ── Pattern 1: "Order #1234" (high confidence) ──

  it('extracts "Order #1234" from subject (high confidence)', () => {
    const matches = extractOrderNumbers('Re: Order #6490 - Design Question', '')
    expect(matches).toContainEqual(
      expect.objectContaining({
        orderNumber: '6490',
        source: 'subject',
        confidence: 'high',
        pattern: 'Order #XXXX',
      })
    )
  })

  it('extracts "Order 1234" without hash (high confidence)', () => {
    const matches = extractOrderNumbers('Order 5678 confirmation', '')
    expect(matches).toContainEqual(
      expect.objectContaining({
        orderNumber: '5678',
        confidence: 'high',
      })
    )
  })

  it('extracts order numbers from body', () => {
    const matches = extractOrderNumbers('', 'Thank you for Order #1234.')
    expect(matches).toContainEqual(
      expect.objectContaining({
        orderNumber: '1234',
        source: 'body',
        confidence: 'high',
      })
    )
  })

  // ── Pattern 2: "#1234" (medium/low confidence) ──

  it('extracts "#1234" from subject (medium confidence)', () => {
    const matches = extractOrderNumbers('About #5555', '')
    expect(matches).toContainEqual(
      expect.objectContaining({
        orderNumber: '5555',
        source: 'subject',
        confidence: 'medium',
        pattern: '#XXXX',
      })
    )
  })

  it('extracts "#1234" from body (low confidence)', () => {
    const matches = extractOrderNumbers('', 'Regarding #7777 please check')
    expect(matches).toContainEqual(
      expect.objectContaining({
        orderNumber: '7777',
        source: 'body',
        confidence: 'low',
      })
    )
  })

  // ── Pattern 3: "Ref: 1234" (medium confidence) ──

  it('extracts "Ref: 1234" from subject', () => {
    const matches = extractOrderNumbers('Ref: 4321 - Follow up', '')
    expect(matches).toContainEqual(
      expect.objectContaining({
        orderNumber: '4321',
        confidence: 'medium',
        pattern: 'Ref: XXXX',
      })
    )
  })

  it('extracts "Reference: 1234" from body', () => {
    const matches = extractOrderNumbers('', 'Reference: 8888')
    expect(matches).toContainEqual(
      expect.objectContaining({
        orderNumber: '8888',
        source: 'body',
        confidence: 'low',
      })
    )
  })

  // ── Pattern 4: Shopify format "SO-1234-ABC" ──
  // NOTE: The Shopify format regex exists in the source code but matched
  // strings are >6 chars, so they get filtered by the length check.
  // This test documents the actual (broken) behavior.

  it('Shopify format "SO-1234-ABC" is filtered by length check (>6 chars)', () => {
    const matches = extractOrderNumbers('Order #SO-1234-ABC shipped', '')
    expect(matches).toHaveLength(0)
  })

  // ── Deduplication ──

  it('deduplicates same order number from same source', () => {
    const matches = extractOrderNumbers(
      'Order #1234 and Order #1234 again',
      ''
    )
    const order1234 = matches.filter((m) => m.orderNumber === '1234')
    expect(order1234).toHaveLength(1)
  })

  it('allows same order number from different sources', () => {
    const matches = extractOrderNumbers('Order #1234', 'Order #1234')
    const order1234 = matches.filter((m) => m.orderNumber === '1234')
    expect(order1234).toHaveLength(2)
    expect(order1234.map((m) => m.source)).toContain('subject')
    expect(order1234.map((m) => m.source)).toContain('body')
  })

  // ── Filtering ──

  it('filters out numbers longer than 6 digits', () => {
    const matches = extractOrderNumbers('Order #1234567', '')
    expect(matches).toHaveLength(0)
  })

  it('requires at least 3 digits', () => {
    const matches = extractOrderNumbers('Order #12', '')
    expect(matches).toHaveLength(0)
  })

  // ── Multiple matches ──

  it('extracts multiple different order numbers', () => {
    const matches = extractOrderNumbers(
      'Order #1234 and Order #5678',
      'Also see Ref: 9012'
    )
    const orderNumbers = matches.map((m) => m.orderNumber)
    expect(orderNumbers).toContain('1234')
    expect(orderNumbers).toContain('5678')
    expect(orderNumbers).toContain('9012')
  })

  // ── Edge cases ──

  it('returns empty array for empty strings', () => {
    const matches = extractOrderNumbers('', '')
    expect(matches).toHaveLength(0)
  })

  it('returns empty array for text with no order numbers', () => {
    const matches = extractOrderNumbers(
      'Hello, how are you?',
      'Just checking in about the project.'
    )
    expect(matches).toHaveLength(0)
  })

  it('handles 3-digit order numbers', () => {
    const matches = extractOrderNumbers('Order #123', '')
    expect(matches).toContainEqual(
      expect.objectContaining({ orderNumber: '123' })
    )
  })

  it('handles 6-digit order numbers', () => {
    const matches = extractOrderNumbers('Order #123456', '')
    expect(matches).toContainEqual(
      expect.objectContaining({ orderNumber: '123456' })
    )
  })
})
