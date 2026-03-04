import { describe, it, expect } from 'vitest'
import { detectOrderType } from '../detect-order-type'

describe('detectOrderType', () => {
  // ── PRIORITY 1: Customify Orders ──

  it('detects Customify order from line item properties', () => {
    const order = {
      line_items: [
        {
          title: 'Custom Fan',
          properties: [{ name: 'Customify Design URL', value: 'https://example.com' }],
        },
      ],
    }
    expect(detectOrderType(order)).toBe('customify_order')
  })

  it('detects Customify order from line item title', () => {
    const order = {
      line_items: [{ title: 'Customify Hand Fan - Large' }],
    }
    expect(detectOrderType(order)).toBe('customify_order')
  })

  it('detects Customify order from tags', () => {
    const order = {
      tags: 'vip, customify, rush',
      line_items: [{ title: 'Hand Fan' }],
    }
    expect(detectOrderType(order)).toBe('customify_order')
  })

  it('Customify property takes priority over design service title', () => {
    const order = {
      line_items: [
        {
          title: 'Custom Fan Design Service',
          properties: [{ name: 'customify_file_id', value: '123' }],
        },
      ],
    }
    expect(detectOrderType(order)).toBe('customify_order')
  })

  // ── PRIORITY 2: Custom Design Service ──

  it('detects "Professional Custom Fan Design Service"', () => {
    const order = {
      line_items: [{ title: 'Professional Custom Fan Design Service' }],
    }
    expect(detectOrderType(order)).toBe('custom_design_service')
  })

  it('detects "Custom Fan Design Service"', () => {
    const order = {
      line_items: [{ title: 'Custom Fan Design Service' }],
    }
    expect(detectOrderType(order)).toBe('custom_design_service')
  })

  it('detects "Design Service & Credit"', () => {
    const order = {
      line_items: [{ title: 'Design Service & Credit' }],
    }
    expect(detectOrderType(order)).toBe('custom_design_service')
  })

  it('detects "Custom Fan Designer"', () => {
    const order = {
      line_items: [{ title: 'Custom Fan Designer' }],
    }
    expect(detectOrderType(order)).toBe('custom_design_service')
  })

  it('detects design service via tags fallback', () => {
    const order = {
      tags: 'custom design',
      line_items: [{ title: 'Hand Fan' }],
    }
    expect(detectOrderType(order)).toBe('custom_design_service')
  })

  // ── PRIORITY 3: Etsy Personalization ──

  it('detects Etsy order from Personalization property', () => {
    const order = {
      line_items: [
        {
          title: 'Custom Hand Fan',
          properties: [{ name: 'Personalization', value: 'John & Jane' }],
        },
      ],
    }
    expect(detectOrderType(order)).toBe('custom_bulk_order')
  })

  // ── PRIORITY 4: Bulk Orders ──

  it('detects "Bulk Order" in title', () => {
    const order = {
      line_items: [{ title: 'Bulk Order - 100 Fans' }],
    }
    expect(detectOrderType(order)).toBe('custom_bulk_order')
  })

  it('detects "Bulk Fan" in title', () => {
    const order = {
      line_items: [{ title: 'Bulk Fan Package' }],
    }
    expect(detectOrderType(order)).toBe('custom_bulk_order')
  })

  it('detects "Custom Bulk" in title', () => {
    const order = {
      line_items: [{ title: 'Custom Bulk Hand Fans' }],
    }
    expect(detectOrderType(order)).toBe('custom_bulk_order')
  })

  it('detects bulk order via tags', () => {
    const order = {
      tags: 'custom bulk',
      line_items: [{ title: 'Hand Fan' }],
    }
    expect(detectOrderType(order)).toBe('custom_bulk_order')
  })

  it('detects Etsy order via tags', () => {
    const order = {
      tags: 'etsy',
      line_items: [{ title: 'Hand Fan' }],
    }
    expect(detectOrderType(order)).toBe('custom_bulk_order')
  })

  // ── Edge cases ──

  it('returns null for unrecognized order', () => {
    const order = {
      line_items: [{ title: 'Regular Hand Fan' }],
    }
    expect(detectOrderType(order)).toBeNull()
  })

  it('handles order with no line_items', () => {
    const order = {}
    expect(detectOrderType(order)).toBeNull()
  })

  it('handles order with empty line_items array', () => {
    const order = { line_items: [] }
    expect(detectOrderType(order)).toBeNull()
  })

  it('handles null/undefined properties gracefully', () => {
    const order = {
      line_items: [{ title: null, properties: null }],
    }
    expect(detectOrderType(order)).toBeNull()
  })

  it('handles non-array properties gracefully', () => {
    const order = {
      line_items: [{ title: 'Fan', properties: { name: 'color', value: 'red' } }],
    }
    // Non-array properties should be treated as empty
    expect(detectOrderType(order)).toBeNull()
  })

  it('is case-insensitive for titles', () => {
    const order = {
      line_items: [{ title: 'CUSTOMIFY HAND FAN' }],
    }
    expect(detectOrderType(order)).toBe('customify_order')
  })

  it('is case-insensitive for tags', () => {
    const order = {
      tags: 'CUSTOMIFY, VIP',
      line_items: [{ title: 'Hand Fan' }],
    }
    expect(detectOrderType(order)).toBe('customify_order')
  })

  it('checks multiple line items', () => {
    const order = {
      line_items: [
        { title: 'Shipping Label' },
        { title: 'Custom Fan Design Service' },
      ],
    }
    expect(detectOrderType(order)).toBe('custom_design_service')
  })
})
