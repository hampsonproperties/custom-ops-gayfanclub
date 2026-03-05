import * as Sentry from '@sentry/nextjs'

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,

  // Only send errors — no performance tracing, no replays.
  // Keeps it simple and avoids unnecessary data/costs.
  tracesSampleRate: 0,
  replaysSessionSampleRate: 0,
  replaysOnErrorSampleRate: 0,

  // Don't send PII (emails, IPs) to Sentry
  sendDefaultPii: false,

  // Only report errors in production
  enabled: process.env.NODE_ENV === 'production',
})

// Required by Sentry SDK to instrument client-side navigations
export const onRouterTransitionStart = Sentry.captureRouterTransitionStart
