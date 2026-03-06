/**
 * Email Polish Route Tests
 *
 * Tests POST /api/email/polish — rewrites draft email text in brand voice
 * using OpenAI GPT-3.5-turbo. All OpenAI calls are mocked.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { NextRequest } from 'next/server'

// ---------------------------------------------------------------------------
// Hoisted mocks (vi.mock factories run before variable declarations)
// ---------------------------------------------------------------------------

const { mockCreate, mockGetBrandTone } = vi.hoisted(() => ({
  mockCreate: vi.fn(),
  mockGetBrandTone: vi.fn().mockResolvedValue('Test brand tone instructions'),
}))

vi.mock('openai', () => ({
  default: class MockOpenAI {
    chat = { completions: { create: mockCreate } }
  },
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

function makeRequest(body: any): NextRequest {
  return new NextRequest('http://localhost/api/email/polish', {
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

beforeEach(() => {
  vi.clearAllMocks()
  vi.stubEnv('OPENAI_API_KEY', 'test-key-123')
  mockGetBrandTone.mockResolvedValue('Test brand tone instructions')
})

afterEach(() => {
  vi.unstubAllEnvs()
})

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('POST /api/email/polish', () => {
  it('returns polished text from OpenAI', async () => {
    mockOpenAIResponse('Hey! Your fans are almost ready!')

    const res = await POST(makeRequest({ text: 'Your order is being processed.' }))
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json.success).toBe(true)
    expect(json.polished).toBe('Hey! Your fans are almost ready!')
  })

  it('injects brand tone into the system prompt', async () => {
    mockGetBrandTone.mockResolvedValue('Custom voice: be sassy and fun')
    mockOpenAIResponse('polished text')

    await POST(makeRequest({ text: 'test draft' }))

    expect(mockCreate).toHaveBeenCalledOnce()
    const systemPrompt = mockCreate.mock.calls[0][0].messages[0].content
    expect(systemPrompt).toContain('Custom voice: be sassy and fun')
  })

  it('passes the draft text as the user message', async () => {
    mockOpenAIResponse('polished text')

    await POST(makeRequest({ text: 'My rough draft here' }))

    const userMessage = mockCreate.mock.calls[0][0].messages[1].content
    expect(userMessage).toBe('My rough draft here')
  })

  it('rejects empty text with 400', async () => {
    const res = await POST(makeRequest({ text: '' }))
    expect(res.status).toBe(400)
  })

  it('rejects text over 10000 chars with 400', async () => {
    const res = await POST(makeRequest({ text: 'a'.repeat(10001) }))
    expect(res.status).toBe(400)
  })

  it('returns 500 when OPENAI_API_KEY is missing', async () => {
    vi.stubEnv('OPENAI_API_KEY', '')

    const res = await POST(makeRequest({ text: 'test draft' }))
    expect(res.status).toBe(500)
  })
})
