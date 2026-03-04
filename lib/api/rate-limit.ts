/**
 * In-memory sliding window rate limiter.
 *
 * How it works: tracks timestamps of recent requests per key (IP or userId).
 * When a new request arrives, it counts how many requests happened in the
 * last N seconds. If the count exceeds the limit, the request is rejected.
 *
 * Works well in Vercel Edge middleware (warm instances maintain state between
 * requests). For production-grade distributed rate limiting across multiple
 * regions, upgrade to @upstash/ratelimit with Redis.
 */

interface RateLimitConfig {
  windowMs: number
  maxRequests: number
}

interface RateLimitResult {
  allowed: boolean
  remaining: number
  resetIn: number // seconds until the window resets
}

// Store: key -> array of request timestamps
const store = new Map<string, number[]>()

// Periodic cleanup to prevent memory leaks
let lastCleanup = Date.now()
const CLEANUP_INTERVAL = 5 * 60 * 1000 // 5 minutes
const MAX_WINDOW = 60 * 60 * 1000 // 1 hour (largest window we support)

function cleanup() {
  const now = Date.now()
  if (now - lastCleanup < CLEANUP_INTERVAL) return
  lastCleanup = now

  for (const [key, timestamps] of store) {
    const valid = timestamps.filter(t => now - t < MAX_WINDOW)
    if (valid.length === 0) {
      store.delete(key)
    } else {
      store.set(key, valid)
    }
  }
}

export function checkRateLimit(
  key: string,
  config: RateLimitConfig
): RateLimitResult {
  const now = Date.now()

  cleanup()

  const timestamps = store.get(key) || []
  const validTimestamps = timestamps.filter(t => now - t < config.windowMs)

  if (validTimestamps.length >= config.maxRequests) {
    const oldestInWindow = validTimestamps[0]
    const resetIn = Math.ceil((oldestInWindow + config.windowMs - now) / 1000)
    return { allowed: false, remaining: 0, resetIn: Math.max(resetIn, 1) }
  }

  // Allow and record
  validTimestamps.push(now)
  store.set(key, validTimestamps)

  return {
    allowed: true,
    remaining: config.maxRequests - validTimestamps.length,
    resetIn: Math.ceil(config.windowMs / 1000),
  }
}

// Predefined rate limit tiers
export const RATE_LIMITS = {
  /** Webhooks: 100 requests/min per IP (Shopify retries aggressively) */
  webhook: { windowMs: 60_000, maxRequests: 100 },
  /** Cron jobs: 12 requests/min per IP (one per schedule + buffer) */
  cron: { windowMs: 60_000, maxRequests: 12 },
  /** General API: 60 requests/min per user */
  api: { windowMs: 60_000, maxRequests: 60 },
  /** Search: 30 requests/min per user (heavier queries) */
  search: { windowMs: 60_000, maxRequests: 30 },
  /** Login page: 10 loads/min per IP (brute force protection) */
  login: { windowMs: 60_000, maxRequests: 10 },
} as const
