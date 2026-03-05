/**
 * Structured Logger
 *
 * Replaces raw console.log/error/warn with structured output that includes:
 * - Log level (info, warn, error, debug)
 * - Timestamp
 * - Module name (for filtering in Vercel logs)
 * - Contextual data (orderId, workItemId, batchId, etc.)
 *
 * In production (Vercel): outputs JSON for automatic parsing and filtering.
 * In development: outputs human-readable format with color.
 *
 * Sentry integration: all error() calls automatically report to Sentry
 * when NEXT_PUBLIC_SENTRY_DSN is configured. No changes needed in calling code.
 *
 * Usage:
 *   import { logger } from '@/lib/logger'
 *   const log = logger('shopify-webhook')
 *   log.info('Processing order', { orderNumber: '#1234', orderType: 'customify' })
 *   log.error('Failed to import', { error, workItemId: '...' })
 */

import * as Sentry from '@sentry/nextjs'

type LogLevel = 'debug' | 'info' | 'warn' | 'error'

interface LogContext {
  [key: string]: unknown
}

interface Logger {
  debug: (message: string, context?: LogContext) => void
  info: (message: string, context?: LogContext) => void
  warn: (message: string, context?: LogContext) => void
  error: (message: string, context?: LogContext) => void
}

const IS_PRODUCTION = process.env.NODE_ENV === 'production'

function formatError(err: unknown): object | string {
  if (err instanceof Error) {
    return {
      name: err.name,
      message: err.message,
      stack: IS_PRODUCTION ? err.stack?.split('\n').slice(0, 5).join('\n') : err.stack,
    }
  }
  if (typeof err === 'string') return err
  return String(err)
}

function processContext(context?: LogContext): LogContext | undefined {
  if (!context) return undefined
  const processed: LogContext = {}
  for (const [key, value] of Object.entries(context)) {
    if (key === 'error' || key === 'err') {
      processed[key] = formatError(value)
    } else {
      processed[key] = value
    }
  }
  return processed
}

function reportToSentry(module: string, message: string, context?: LogContext) {
  try {
    // Extract the original error if one was passed, otherwise create one from the message
    const error = context?.error instanceof Error
      ? context.error
      : context?.err instanceof Error
        ? context.err
        : new Error(message)

    // Strip error from extra context since it's already the main exception
    const extra: Record<string, unknown> = {}
    if (context) {
      for (const [key, value] of Object.entries(context)) {
        if (key !== 'error' && key !== 'err') {
          extra[key] = value
        }
      }
    }

    Sentry.captureException(error, {
      tags: { module },
      extra: { ...extra, logMessage: message },
    })
  } catch {
    // Never let Sentry reporting break the app
  }
}

function logStructured(level: LogLevel, module: string, message: string, context?: LogContext) {
  const processedContext = processContext(context)

  // Report errors to Sentry (production only, when DSN is configured)
  if (level === 'error' && IS_PRODUCTION) {
    reportToSentry(module, message, context)
  }

  if (IS_PRODUCTION) {
    // JSON output for Vercel log parsing
    const entry: Record<string, unknown> = {
      level,
      module,
      msg: message,
      ts: new Date().toISOString(),
    }
    if (processedContext) {
      Object.assign(entry, processedContext)
    }

    const json = JSON.stringify(entry)
    switch (level) {
      case 'error':
        console.error(json)
        break
      case 'warn':
        console.warn(json)
        break
      default:
        console.log(json)
    }
  } else {
    // Human-readable output for development
    const prefix = `[${level.toUpperCase()}] [${module}]`
    const args: unknown[] = [prefix, message]
    if (processedContext && Object.keys(processedContext).length > 0) {
      args.push(processedContext)
    }

    switch (level) {
      case 'error':
        console.error(...args)
        break
      case 'warn':
        console.warn(...args)
        break
      case 'debug':
        console.debug(...args)
        break
      default:
        console.log(...args)
    }
  }
}

/**
 * Create a logger for a specific module.
 *
 * @param module - Module name shown in logs (e.g., 'shopify-webhook', 'email-import', 'batch-api')
 * @returns Logger instance with debug/info/warn/error methods
 */
export function logger(module: string): Logger {
  return {
    debug: (message: string, context?: LogContext) => logStructured('debug', module, message, context),
    info: (message: string, context?: LogContext) => logStructured('info', module, message, context),
    warn: (message: string, context?: LogContext) => logStructured('warn', module, message, context),
    error: (message: string, context?: LogContext) => logStructured('error', module, message, context),
  }
}
