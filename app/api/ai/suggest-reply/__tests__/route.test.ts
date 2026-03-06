/**
 * AI Suggest Reply Route Tests
 *
 * Tests POST /api/ai/suggest-reply — generates a draft reply using
 * conversation context, reference docs, and brand voice.
 * All OpenAI and Supabase calls are mocked.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { NextRequest } from 'next/server'

// ---------------------------------------------------------------------------
// Hoisted mocks (vi.mock factories run before variable declarations)
// ---------------------------------------------------------------------------

const { mockCreate, mockFrom, mockGetBrandTone } = vi.hoisted(() => ({
  mockCreate: vi.fn(),
  mockFrom: vi.fn(),
  mockGetBrandTone: vi.fn().mockResolvedValue('Test brand tone'),
}))

vi.mock('openai', () => ({
  default: class MockOpenAI {
    chat = { completions: { create: mockCreate } }
  },
}))

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn().mockResolvedValue({ from: mockFrom }),
}))

vi.mock('@/lib/ai/brand-tone', () => ({
  getBrandTone: mockGetBrandTone,
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
  return new NextRequest('http://localhost/api/ai/suggest-reply', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

/**
 * Sets up mockFrom for all tables.
 * reference_docs can be customized via opts.referenceDocs.
 */
function setupSupabase(opts: { referenceDocs?: any[] } = {}) {
  mockFrom.mockImplementation((table: string) => {
    if (table === 'reference_docs') {
      return {
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            order: vi.fn().mockResolvedValue({
              data: opts.referenceDocs ?? [],
              error: null,
            }),
          }),
        }),
      }
    }
    // Default: empty results for all other tables
    return {
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
    }
  })
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.stubEnv('OPENAI_API_KEY', 'test-key-123')
  mockGetBrandTone.mockResolvedValue('Test brand tone')
  setupSupabase()
})

afterEach(() => {
  vi.unstubAllEnvs()
})

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('POST /api/ai/suggest-reply', () => {
  it('returns reply and suggested subject line', async () => {
    // First call = reply body, second call = subject line
    mockCreate
      .mockResolvedValueOnce({ choices: [{ message: { content: 'Hey! Great question about pricing.' } }] })
      .mockResolvedValueOnce({ choices: [{ message: { content: 'Re: Pricing Question' } }] })

    const res = await POST(makeRequest({ workItemId: WORK_ITEM_ID }))
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json.success).toBe(true)
    expect(json.reply).toBe('Hey! Great question about pricing.')
    expect(json.subject).toBe('Re: Pricing Question')
  })

  it('includes reference docs in the prompt context', async () => {
    setupSupabase({
      referenceDocs: [
        { name: 'Price Sheet', category: 'pricing', content_text: 'Small fan: $25. Large fan: $45.' },
      ],
    })
    mockCreate
      .mockResolvedValueOnce({ choices: [{ message: { content: 'reply' } }] })
      .mockResolvedValueOnce({ choices: [{ message: { content: 'subject' } }] })

    await POST(makeRequest({ workItemId: WORK_ITEM_ID }))

    // The user message (second message) should contain reference doc text
    const userMessage = mockCreate.mock.calls[0][0].messages[1].content
    expect(userMessage).toContain('Small fan: $25')
    expect(userMessage).toContain('Price Sheet')
  })

  it('injects brand tone into system prompt', async () => {
    mockGetBrandTone.mockResolvedValue('Be extremely enthusiastic and use lots of exclamation marks!')
    mockCreate
      .mockResolvedValueOnce({ choices: [{ message: { content: 'reply' } }] })
      .mockResolvedValueOnce({ choices: [{ message: { content: 'subject' } }] })

    await POST(makeRequest({ customerId: CUSTOMER_ID }))

    const systemPrompt = mockCreate.mock.calls[0][0].messages[0].content
    expect(systemPrompt).toContain('Be extremely enthusiastic and use lots of exclamation marks!')
  })

  it('rejects when neither workItemId nor customerId provided', async () => {
    const res = await POST(makeRequest({}))
    expect(res.status).toBe(400)
  })

  it('returns 500 when OpenAI errors', async () => {
    mockCreate.mockRejectedValue(new Error('API error'))

    const res = await POST(makeRequest({ workItemId: WORK_ITEM_ID }))
    expect(res.status).toBe(500)
  })

  it('returns 500 when OPENAI_API_KEY is missing', async () => {
    vi.stubEnv('OPENAI_API_KEY', '')

    const res = await POST(makeRequest({ workItemId: WORK_ITEM_ID }))
    expect(res.status).toBe(500)
  })
})
