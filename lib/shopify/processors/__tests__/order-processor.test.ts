/**
 * Order Processor Tests
 *
 * Tests the three-tier routing logic:
 * 1. Custom orders → create/update work items
 * 2. Stock orders + retail account → log to customer_orders
 * 3. Stock orders + no match → skip
 *
 * Also tests Faire auto-creation and edge cases.
 *
 * Strategy: mock Supabase at the module level so processOrder()
 * calls our fake DB. All other imported helpers are also mocked
 * since they have their own dependencies.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { processOrder } from '../order-processor'

// ---------------------------------------------------------------------------
// Mock all external dependencies
// ---------------------------------------------------------------------------

// Mock detect-order-type — we control what type each order is
vi.mock('@/lib/shopify/detect-order-type', () => ({
  detectOrderType: vi.fn(),
}))

// Mock data-extractors — return simple defaults
vi.mock('../data-extractors', () => ({
  extractCustomerData: vi.fn((order: any) => ({
    customerName: order.customer?.first_name
      ? `${order.customer.first_name} ${order.customer.last_name || ''}`.trim()
      : null,
    customerEmail: order.customer?.email?.toLowerCase() || null,
    phoneNumber: order.customer?.phone || null,
    companyName: order.shipping_address?.company || null,
    address: null,
  })),
  extractLineItemData: vi.fn(() => ({
    quantity: 1,
    gripColor: null,
    designPreviewUrl: null,
    designDownloadUrl: null,
  })),
  extractPaymentHistory: vi.fn(() => []),
  determineStatus: vi.fn(() => 'needs_design_review'),
}))

// Mock other helpers — no-ops to prevent real calls
vi.mock('../file-downloader', () => ({
  extractCustomifyFiles: vi.fn(() => []),
  importCustomifyFiles: vi.fn(),
}))

vi.mock('../email-auto-linker', () => ({
  autoLinkEmails: vi.fn(),
}))

vi.mock('../comment-sync', () => ({
  syncOrderComments: vi.fn(),
}))

vi.mock('@/lib/shopify/sync-customer-tags', () => ({
  syncCustomerTags: vi.fn(() => ({ linked: 0, created: 0, errors: [] })),
}))

vi.mock('@/lib/shopify/customer-orders', () => ({
  createCustomerOrder: vi.fn(),
  findOrCreateCustomer: vi.fn(() => 'cust-uuid-123'),
}))

vi.mock('@/lib/logger', () => ({
  logger: () => ({
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  }),
}))

// ---------------------------------------------------------------------------
// Import the mocked detectOrderType so we can control it per test
// ---------------------------------------------------------------------------

import { detectOrderType } from '@/lib/shopify/detect-order-type'
const mockDetectOrderType = detectOrderType as ReturnType<typeof vi.fn>

// ---------------------------------------------------------------------------
// Supabase mock builder
// ---------------------------------------------------------------------------

function createMockSupabase(overrides: {
  customerOrdersSelect?: any
  retailAccountByCustomerId?: any
  retailAccountByEmail?: any
  workItemByOrderNumber?: any
  workItemInsert?: any
  retailAccountInsert?: any
} = {}) {
  const updateFn = vi.fn().mockReturnValue({ eq: vi.fn().mockReturnValue({ eq: vi.fn() }) })
  const insertFn = vi.fn().mockReturnValue({
    select: vi.fn().mockReturnValue({
      single: vi.fn().mockResolvedValue(
        overrides.workItemInsert ?? { data: { id: 'wi-new-123', status: 'needs_design_review' }, error: null }
      ),
    }),
  })

  // Tracks all insert calls so tests can inspect them
  const insertCalls: Array<{ table: string; data: any }> = []

  const from = vi.fn((table: string) => {
    if (table === 'customer_orders') {
      return {
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            maybeSingle: vi.fn().mockResolvedValue(
              overrides.customerOrdersSelect ?? { data: null, error: null }
            ),
          }),
        }),
        insert: vi.fn().mockImplementation((data: any) => {
          insertCalls.push({ table: 'customer_orders', data })
          return Promise.resolve({ data: null, error: null })
        }),
        update: updateFn,
      }
    }

    if (table === 'retail_accounts') {
      return {
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            maybeSingle: vi.fn().mockResolvedValue(
              overrides.retailAccountByCustomerId ?? { data: null, error: null }
            ),
          }),
          or: vi.fn().mockReturnValue({
            limit: vi.fn().mockReturnValue({
              maybeSingle: vi.fn().mockResolvedValue(
                overrides.retailAccountByEmail ?? { data: null, error: null }
              ),
            }),
          }),
        }),
        insert: vi.fn().mockImplementation((data: any) => {
          insertCalls.push({ table: 'retail_accounts', data })
          return {
            select: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue(
                overrides.retailAccountInsert ?? { data: { id: 'ra-auto-123' }, error: null }
              ),
            }),
          }
        }),
      }
    }

    if (table === 'work_items') {
      return {
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            maybeSingle: vi.fn().mockResolvedValue(
              overrides.workItemByOrderNumber ?? { data: null, error: null }
            ),
          }),
          not: vi.fn().mockReturnValue({
            is: vi.fn().mockReturnValue({
              order: vi.fn().mockReturnValue({
                limit: vi.fn().mockReturnValue({
                  maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
                }),
              }),
            }),
          }),
        }),
        insert: insertFn,
        update: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({ data: null, error: null }),
        }),
      }
    }

    if (table === 'webhook_events') {
      return {
        update: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({ data: null, error: null }),
        }),
      }
    }

    if (table === 'work_item_status_events') {
      return {
        insert: vi.fn().mockImplementation((data: any) => {
          insertCalls.push({ table: 'work_item_status_events', data })
          return Promise.resolve({ data: null, error: null })
        }),
      }
    }

    if (table === 'work_item_notes') {
      return {
        insert: vi.fn().mockImplementation((data: any) => {
          insertCalls.push({ table: 'work_item_notes', data })
          return Promise.resolve({ data: null, error: null })
        }),
      }
    }

    if (table === 'communications') {
      return {
        select: vi.fn().mockReturnValue({
          ilike: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue({ data: [], error: null }),
          }),
        }),
      }
    }

    if (table === 'customers') {
      return {
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
          }),
        }),
        update: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            is: vi.fn().mockResolvedValue({ data: null, error: null }),
          }),
        }),
        insert: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({ data: null, error: null }),
          }),
        }),
      }
    }

    // Default fallback
    return {
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
        }),
      }),
      insert: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({ data: null, error: null }),
        }),
      }),
      update: vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValue({ data: null, error: null }),
      }),
    }
  })

  return { from, insertCalls, rpc: vi.fn().mockResolvedValue({ data: null }) }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeOrder(overrides: any = {}) {
  return {
    id: 123456,
    name: '#1234',
    email: 'customer@example.com',
    financial_status: 'paid',
    fulfillment_status: null,
    total_price: '49.99',
    currency: 'USD',
    tags: '',
    note: null,
    created_at: '2026-03-01T00:00:00Z',
    updated_at: '2026-03-01T00:00:00Z',
    customer: {
      id: 99999,
      email: 'customer@example.com',
      first_name: 'Jane',
      last_name: 'Doe',
      phone: null,
      note: null,
      tags: '',
    },
    shipping_address: {
      company: null,
      name: 'Jane Doe',
      address1: '123 Main St',
      address2: null,
      city: 'Austin',
      province_code: 'TX',
      zip: '78701',
      country_code: 'US',
      phone: null,
    },
    line_items: [
      {
        title: 'Stock Fan - Rainbow',
        quantity: 2,
        properties: [],
      },
    ],
    transactions: [],
    ...overrides,
  }
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

beforeEach(() => {
  vi.clearAllMocks()
})

describe('processOrder — three-tier routing', () => {
  // ── Path 1: Custom order → creates work item ──

  it('routes custom order to work item creation', async () => {
    mockDetectOrderType.mockReturnValue('customify_order')

    const supabase = createMockSupabase()
    const order = makeOrder({
      line_items: [{ title: 'Customify Fan', quantity: 1, properties: [{ name: 'Customify Design URL', value: 'https://...' }] }],
    })

    await processOrder(supabase as any, order, 'wh-event-1')

    // Should have called from('work_items') to look for existing, then insert
    const workItemCalls = supabase.from.mock.calls.filter(([t]: [string]) => t === 'work_items')
    expect(workItemCalls.length).toBeGreaterThan(0)

    // Should NOT have tried to find a retail account
    const retailCalls = supabase.from.mock.calls.filter(([t]: [string]) => t === 'retail_accounts')
    expect(retailCalls.length).toBe(0)
  })

  it('routes custom_design_service order to work item creation', async () => {
    mockDetectOrderType.mockReturnValue('custom_design_service')

    const supabase = createMockSupabase()
    const order = makeOrder({
      line_items: [{ title: 'Custom Fan Design Service', quantity: 1, properties: [] }],
    })

    await processOrder(supabase as any, order, 'wh-event-2')

    // Should query work_items
    const workItemCalls = supabase.from.mock.calls.filter(([t]: [string]) => t === 'work_items')
    expect(workItemCalls.length).toBeGreaterThan(0)
  })

  // ── Path 2: Stock order + retail account → customer_orders ──

  it('routes stock order with retail account match to customer_orders', async () => {
    mockDetectOrderType.mockReturnValue(null)

    const supabase = createMockSupabase({
      retailAccountByCustomerId: { data: { id: 'ra-existing-456' }, error: null },
    })
    const order = makeOrder()

    await processOrder(supabase as any, order, 'wh-event-3')

    // Should have inserted into customer_orders
    const customerOrderInserts = supabase.insertCalls.filter((c: any) => c.table === 'customer_orders')
    expect(customerOrderInserts.length).toBe(1)
    expect(customerOrderInserts[0].data.retail_account_id).toBe('ra-existing-456')
    expect(customerOrderInserts[0].data.order_type).toBe('stock_order')
    expect(customerOrderInserts[0].data.shopify_order_number).toBe('#1234')
  })

  // ── Path 3: Stock order + no match → skip ──

  it('skips stock order with no retail account match', async () => {
    mockDetectOrderType.mockReturnValue(null)

    const supabase = createMockSupabase()
    const order = makeOrder()

    await processOrder(supabase as any, order, 'wh-event-4')

    // Should NOT have inserted into customer_orders
    const customerOrderInserts = supabase.insertCalls.filter((c: any) => c.table === 'customer_orders')
    expect(customerOrderInserts.length).toBe(0)

    // Should still mark webhook completed
    const webhookCalls = supabase.from.mock.calls.filter(([t]: [string]) => t === 'webhook_events')
    expect(webhookCalls.length).toBeGreaterThan(0)
  })
})

describe('processOrder — stock order updates', () => {
  it('updates existing stock order on orders/updated webhook', async () => {
    mockDetectOrderType.mockReturnValue(null)

    const supabase = createMockSupabase({
      customerOrdersSelect: { data: { id: 'co-existing-789', retail_account_id: 'ra-456' }, error: null },
    })
    const order = makeOrder({ financial_status: 'refunded' })

    await processOrder(supabase as any, order, 'wh-event-5')

    // Should NOT insert a new customer_order (it already exists)
    const customerOrderInserts = supabase.insertCalls.filter((c: any) => c.table === 'customer_orders')
    expect(customerOrderInserts.length).toBe(0)

    // Should NOT try to find retail account (short-circuits after finding existing order)
    const retailCalls = supabase.from.mock.calls.filter(([t]: [string]) => t === 'retail_accounts')
    expect(retailCalls.length).toBe(0)
  })
})

describe('processOrder — Faire auto-creation', () => {
  it('auto-creates retail account for Faire order when no match exists', async () => {
    mockDetectOrderType.mockReturnValue(null)

    const supabase = createMockSupabase()
    const order = makeOrder({
      tags: 'Faire, Wholesale',
      shipping_address: {
        company: 'Plur City',
        name: 'Alex Smith',
        address1: '789 Boutique Lane',
        address2: 'Suite 200',
        city: 'Portland',
        province_code: 'OR',
        zip: '97201',
        country_code: 'US',
        phone: '555-0199',
      },
    })

    await processOrder(supabase as any, order, 'wh-event-6')

    // Should have inserted a retail_accounts row
    const retailInserts = supabase.insertCalls.filter((c: any) => c.table === 'retail_accounts')
    expect(retailInserts.length).toBe(1)
    expect(retailInserts[0].data.account_name).toBe('Plur City')
    expect(retailInserts[0].data.tags).toContain('Faire')
    expect(retailInserts[0].data.shopify_customer_id).toBe('99999')
    expect(retailInserts[0].data.city).toBe('Portland')
    expect(retailInserts[0].data.business_address).toBe('789 Boutique Lane, Suite 200')

    // Should then insert a customer_order with the new retail account
    const customerOrderInserts = supabase.insertCalls.filter((c: any) => c.table === 'customer_orders')
    expect(customerOrderInserts.length).toBe(1)
  })

  it('does not auto-create retail account for non-Faire stock orders', async () => {
    mockDetectOrderType.mockReturnValue(null)

    const supabase = createMockSupabase()
    const order = makeOrder({ tags: 'some-random-tag' })

    await processOrder(supabase as any, order, 'wh-event-7')

    // No retail account should be created
    const retailInserts = supabase.insertCalls.filter((c: any) => c.table === 'retail_accounts')
    expect(retailInserts.length).toBe(0)

    // No customer_order should be created (no retail account match)
    const customerOrderInserts = supabase.insertCalls.filter((c: any) => c.table === 'customer_orders')
    expect(customerOrderInserts.length).toBe(0)
  })

  it('does not auto-create when Faire order already matches existing retail account', async () => {
    mockDetectOrderType.mockReturnValue(null)

    const supabase = createMockSupabase({
      retailAccountByCustomerId: { data: { id: 'ra-already-exists' }, error: null },
    })
    const order = makeOrder({ tags: 'Faire, Wholesale' })

    await processOrder(supabase as any, order, 'wh-event-8')

    // Should NOT create a new retail account
    const retailInserts = supabase.insertCalls.filter((c: any) => c.table === 'retail_accounts')
    expect(retailInserts.length).toBe(0)

    // Should log order against existing retail account
    const customerOrderInserts = supabase.insertCalls.filter((c: any) => c.table === 'customer_orders')
    expect(customerOrderInserts.length).toBe(1)
    expect(customerOrderInserts[0].data.retail_account_id).toBe('ra-already-exists')
  })

  it('requires both "faire" AND "wholesale" tags for auto-creation', async () => {
    mockDetectOrderType.mockReturnValue(null)

    const supabase = createMockSupabase()
    // Only has 'faire' tag — missing 'wholesale'
    const order = makeOrder({ tags: 'Faire' })

    await processOrder(supabase as any, order, 'wh-event-9')

    const retailInserts = supabase.insertCalls.filter((c: any) => c.table === 'retail_accounts')
    expect(retailInserts.length).toBe(0)
  })

  it('handles Faire auto-creation when DB insert fails gracefully', async () => {
    mockDetectOrderType.mockReturnValue(null)

    const supabase = createMockSupabase({
      retailAccountInsert: { data: null, error: { message: 'DB error' } },
    })
    const order = makeOrder({ tags: 'Faire, Wholesale' })

    // Should not throw
    await processOrder(supabase as any, order, 'wh-event-10')

    // Should still mark webhook completed (graceful failure)
    const webhookCalls = supabase.from.mock.calls.filter(([t]: [string]) => t === 'webhook_events')
    expect(webhookCalls.length).toBeGreaterThan(0)
  })

  it('does not save relay email address for Faire accounts', async () => {
    mockDetectOrderType.mockReturnValue(null)

    const supabase = createMockSupabase()
    const order = makeOrder({
      tags: 'Faire, Wholesale',
      customer: {
        id: 99999,
        email: 'buyer@relay.faire.com',
        first_name: 'Faire',
        last_name: 'Buyer',
      },
      shipping_address: {
        company: 'Some Boutique',
        name: 'Owner Name',
        address1: '100 Shop St',
      },
    })

    await processOrder(supabase as any, order, 'wh-event-11')

    const retailInserts = supabase.insertCalls.filter((c: any) => c.table === 'retail_accounts')
    expect(retailInserts.length).toBe(1)
    // primary_contact_email should NOT be in the insert data
    expect(retailInserts[0].data).not.toHaveProperty('primary_contact_email')
  })
})

describe('processOrder — edge cases', () => {
  it('handles order with no customer object', async () => {
    mockDetectOrderType.mockReturnValue(null)

    const supabase = createMockSupabase()
    const order = makeOrder({ customer: undefined })

    // Should not throw
    await processOrder(supabase as any, order, 'wh-event-12')
  })

  it('handles order with no tags', async () => {
    mockDetectOrderType.mockReturnValue(null)

    const supabase = createMockSupabase()
    const order = makeOrder({ tags: null })

    await processOrder(supabase as any, order, 'wh-event-13')

    // Should skip cleanly (no retail match, no Faire)
    const customerOrderInserts = supabase.insertCalls.filter((c: any) => c.table === 'customer_orders')
    expect(customerOrderInserts.length).toBe(0)
  })

  it('Faire tag detection is case-insensitive', async () => {
    mockDetectOrderType.mockReturnValue(null)

    const supabase = createMockSupabase()
    const order = makeOrder({
      tags: 'FAIRE, WHOLESALE',
      shipping_address: { company: 'Test Shop' },
    })

    await processOrder(supabase as any, order, 'wh-event-14')

    const retailInserts = supabase.insertCalls.filter((c: any) => c.table === 'retail_accounts')
    expect(retailInserts.length).toBe(1)
  })
})
