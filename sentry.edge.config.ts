import * as Sentry from '@sentry/nextjs'

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,

  // Only send errors — no performance tracing
  tracesSampleRate: 0,

  // Don't send PII
  sendDefaultPii: false,

  // Only report errors in production
  enabled: process.env.NODE_ENV === 'production',
})
