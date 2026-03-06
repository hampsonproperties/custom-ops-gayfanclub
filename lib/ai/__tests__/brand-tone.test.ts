/**
 * Brand Tone Helper Tests
 *
 * Tests getBrandTone() — reads custom brand voice from the settings table,
 * falls back to DEFAULT_BRAND_TONE when missing or invalid.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock Supabase server client
vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(),
}))

import { createClient } from '@/lib/supabase/server'
import { getBrandTone, DEFAULT_BRAND_TONE } from '../brand-tone'

const mockCreateClient = createClient as ReturnType<typeof vi.fn>

function createMockSupabase(settingsResult: { data: any; error: any }) {
  return {
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          single: vi.fn().mockResolvedValue(settingsResult),
        })),
      })),
    })),
  }
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('getBrandTone', () => {
  it('returns custom tone when saved in DB', async () => {
    const customTone = 'Be cool and casual. Use slang.'
    mockCreateClient.mockResolvedValue(
      createMockSupabase({ data: { value: customTone }, error: null })
    )

    const result = await getBrandTone()
    expect(result).toBe(customTone)
  })

  it('returns DEFAULT_BRAND_TONE when no row exists', async () => {
    mockCreateClient.mockResolvedValue(
      createMockSupabase({ data: null, error: { code: 'PGRST116', message: 'not found' } })
    )

    const result = await getBrandTone()
    expect(result).toBe(DEFAULT_BRAND_TONE)
  })

  it('returns DEFAULT_BRAND_TONE when DB errors', async () => {
    mockCreateClient.mockRejectedValue(new Error('connection failed'))

    const result = await getBrandTone()
    expect(result).toBe(DEFAULT_BRAND_TONE)
  })

  it('returns DEFAULT_BRAND_TONE when value is not a string', async () => {
    mockCreateClient.mockResolvedValue(
      createMockSupabase({ data: { value: { nested: 'object' } }, error: null })
    )

    const result = await getBrandTone()
    expect(result).toBe(DEFAULT_BRAND_TONE)
  })

  it('exports DEFAULT_BRAND_TONE constant', () => {
    expect(DEFAULT_BRAND_TONE).toContain('Playful')
    expect(DEFAULT_BRAND_TONE).toContain('Pride-forward')
    expect(typeof DEFAULT_BRAND_TONE).toBe('string')
  })
})
