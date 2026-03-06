/**
 * AI Summarize Route Tests
 *
 * Tests POST /api/ai/summarize — generates a plain English summary
 * of a project or customer using OpenAI GPT-3.5-turbo.
 * All OpenAI and Supabase calls are mocked.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { NextRequest } from 'next/server'

// ---------------------------------------------------------------------------
// Hoisted mocks (vi.mock factories run before variable declarations)
// ---------------------------------------------------------------------------

const { mockCreate, mockFrom } = vi.hoisted(() => ({
  mockCreate: vi.fn(),
  mockFrom: vi.fn(),
}))

vi.mock('openai', () => ({
  default: class MockOpenAI {
    chat = { completions: { create: mockCreate } }
  },
}))

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn().mockResolvedValue({ from: mockFrom }),
}))

vi.mock('@/lib/logger', () => ({
  logger: () => ({
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  }),
}))

import { POST } from '../route'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const WORK_ITEM_ID = 'a1b2c3d4-e5f6-4a7b-8c9d-e0f1a2b3c4d5'
const CUSTOMER_ID = 'b2c3d4e5-f6a7-4b8c-9d0e-f1a2b3c4d5e6'

function makeRequest(body: any): NextRequest {
  return new NextRequest('http://localhost/api/ai/summarize', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

function mockOpenAIResponse(content: string) {
  mockCreate.mockResolvedValue({
    choices: [{ message: { content } }],
  })
}

/** Sets up mockFrom to return empty results for all tables */
function setupEmptySupabase() {
  mockFrom.mockImplementation(() => ({
    select: vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        single: vi.fn().mockResolvedValue({ data: null, error: null }),
        order: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue({ data: [], error: null }),
        }),
        maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
      }),
      order: vi.fn().mockReturnValue({
        limit: vi.fn().mockResolvedValue({ data: [], error: null }),
      }),
    }),
  }))
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.stubEnv('OPENAI_API_KEY', 'test-key-123')
  setupEmptySupabase()
})

afterEach(() => {
  vi.unstubAllEnvs()
})

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('POST /api/ai/summarize', () => {
  it('returns summary for a work item', async () => {
    mockOpenAIResponse('This project is in design phase. Customer paid $500.')

    const res = await POST(makeRequest({ workItemId: WORK_ITEM_ID }))
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json.success).toBe(true)
    expect(json.summary).toBe('This project is in design phase. Customer paid $500.')
  })

  it('returns summary for a customer', async () => {
    mockOpenAIResponse('Long-time customer with 3 orders.')

    const res = await POST(makeRequest({ customerId: CUSTOMER_ID }))
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json.success).toBe(true)
    expect(json.summary).toBe('Long-time customer with 3 orders.')
  })

  it('rejects when neither workItemId nor customerId provided', async () => {
    const res = await POST(makeRequest({}))
    expect(res.status).toBe(400)
  })

  it('returns 500 when OpenAI errors', async () => {
    mockCreate.mockRejectedValue(new Error('OpenAI rate limit exceeded'))

    const res = await POST(makeRequest({ workItemId: WORK_ITEM_ID }))
    expect(res.status).toBe(500)
  })

  it('returns 500 when OPENAI_API_KEY is missing', async () => {
    vi.stubEnv('OPENAI_API_KEY', '')

    const res = await POST(makeRequest({ workItemId: WORK_ITEM_ID }))
    expect(res.status).toBe(500)
  })
})
