/**
 * Email Generate Route Tests
 *
 * Tests POST /api/email/generate — generates a full email body + subject
 * from a user prompt, project/customer context, and brand voice.
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

const PROJECT_ID = 'a1b2c3d4-e5f6-4a7b-8c9d-e0f1a2b3c4d5'

function makeRequest(body: any): NextRequest {
  return new NextRequest('http://localhost/api/email/generate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

function setupEmptySupabase() {
  mockFrom.mockImplementation(() => ({
    select: vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        single: vi.fn().mockResolvedValue({ data: null, error: null }),
        order: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue({ data: [], error: null }),
        }),
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
  mockGetBrandTone.mockResolvedValue('Test brand tone')
  setupEmptySupabase()
})

afterEach(() => {
  vi.unstubAllEnvs()
})

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('POST /api/email/generate', () => {
  it('returns generated email body and subject', async () => {
    // First call = email body, second call = subject line
    mockCreate
      .mockResolvedValueOnce({ choices: [{ message: { content: '<p>Hey! Your fans are in production.</p>' } }] })
      .mockResolvedValueOnce({ choices: [{ message: { content: 'Production Update' } }] })

    const res = await POST(makeRequest({ prompt: 'Write a production update email' }))
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json.success).toBe(true)
    expect(json.body).toBe('<p>Hey! Your fans are in production.</p>')
    expect(json.subject).toBe('Production Update')
  })

  it('includes project context in the system prompt', async () => {
    mockFrom.mockImplementation((table: string) => {
      if (table === 'work_items') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({
                data: {
                  title: 'Pride Fans 2026',
                  status: 'in_design',
                  event_date: '2026-06-15',
                  estimated_value: 1500,
                  customer: { display_name: 'Alex Rivera', email: 'alex@example.com' },
                },
                error: null,
              }),
            }),
          }),
        }
      }
      return {
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            order: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue({ data: [], error: null }),
            }),
          }),
        }),
      }
    })

    mockCreate
      .mockResolvedValueOnce({ choices: [{ message: { content: 'email body' } }] })
      .mockResolvedValueOnce({ choices: [{ message: { content: 'subject' } }] })

    await POST(makeRequest({ prompt: 'Send a design update', projectId: PROJECT_ID }))

    const systemPrompt = mockCreate.mock.calls[0][0].messages[0].content
    expect(systemPrompt).toContain('Pride Fans 2026')
    expect(systemPrompt).toContain('in_design')
  })

  it('injects brand tone into system prompt', async () => {
    mockGetBrandTone.mockResolvedValue('Be warm, witty, and wonderful')
    mockCreate
      .mockResolvedValueOnce({ choices: [{ message: { content: 'body' } }] })
      .mockResolvedValueOnce({ choices: [{ message: { content: 'subject' } }] })

    await POST(makeRequest({ prompt: 'Write a welcome email' }))

    const systemPrompt = mockCreate.mock.calls[0][0].messages[0].content
    expect(systemPrompt).toContain('Be warm, witty, and wonderful')
  })

  it('rejects empty prompt with 400', async () => {
    const res = await POST(makeRequest({ prompt: '' }))
    expect(res.status).toBe(400)
  })

  it('returns 500 when OPENAI_API_KEY is missing', async () => {
    vi.stubEnv('OPENAI_API_KEY', '')

    const res = await POST(makeRequest({ prompt: 'Write an email' }))
    expect(res.status).toBe(500)
  })
})
