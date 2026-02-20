import pino from 'pino'

/**
 * Structured logger using Pino
 *
 * Benefits:
 * - JSON-formatted logs for easy parsing
 * - Automatic timestamps and context
 * - Request ID tracking
 * - Pretty-printing in development
 * - Performance-optimized
 */

const isDevelopment = process.env.NODE_ENV === 'development'

export const logger = pino({
  level: process.env.LOG_LEVEL || (isDevelopment ? 'debug' : 'info'),
  ...(isDevelopment && {
    transport: {
      target: 'pino-pretty',
      options: {
        colorize: true,
        translateTime: 'HH:MM:ss',
        ignore: 'pid,hostname',
      },
    },
  }),
  base: {
    env: process.env.NODE_ENV,
  },
  formatters: {
    level: (label) => {
      return { level: label.toUpperCase() }
    },
  },
  timestamp: pino.stdTimeFunctions.isoTime,
})

/**
 * Create a child logger with specific context
 *
 * @example
 * ```typescript
 * const log = createLogger('email-import', { emailId: message.id })
 * log.info('Processing email')
 * log.error({ error }, 'Failed to import email')
 * ```
 */
export function createLogger(module: string, context: Record<string, any> = {}) {
  return logger.child({
    module,
    ...context,
  })
}

/**
 * Generate a request ID for tracking operations across logs
 */
export function generateRequestId(): string {
  return `req_${Date.now()}_${Math.random().toString(36).substring(7)}`
}

/**
 * Create a logger with request ID for tracing
 *
 * @example
 * ```typescript
 * const requestId = generateRequestId()
 * const log = createRequestLogger('webhook', requestId, { source: 'shopify' })
 * log.info('Processing webhook')
 * ```
 */
export function createRequestLogger(
  module: string,
  requestId: string,
  context: Record<string, any> = {}
) {
  return logger.child({
    module,
    requestId,
    ...context,
  })
}

/**
 * Log levels:
 * - trace: Very detailed debugging
 * - debug: Debugging information
 * - info: General informational messages (default)
 * - warn: Warning messages
 * - error: Error messages
 * - fatal: Fatal errors that require immediate attention
 *
 * Usage examples:
 *
 * ```typescript
 * import { logger, createLogger } from '@/lib/utils/logger'
 *
 * // Simple logging
 * logger.info('Application started')
 * logger.error({ error }, 'Database connection failed')
 *
 * // Module-specific logging
 * const emailLog = createLogger('email-import')
 * emailLog.debug({ messageId: 'abc123' }, 'Checking for duplicates')
 * emailLog.info({ communicationId: 'xyz789' }, 'Email imported successfully')
 *
 * // Request-scoped logging
 * const requestId = generateRequestId()
 * const webhookLog = createRequestLogger('shopify-webhook', requestId, {
 *   orderId: order.id,
 *   shopifyOrderNumber: order.order_number,
 * })
 * webhookLog.info('Processing order')
 * webhookLog.error({ error }, 'Failed to create work item')
 * ```
 *
 * Log format in production:
 * ```json
 * {
 *   "level": "INFO",
 *   "time": "2026-02-19T10:30:45.123Z",
 *   "module": "email-import",
 *   "requestId": "req_1708343445123_abc7xyz",
 *   "messageId": "abc123",
 *   "msg": "Email imported successfully"
 * }
 * ```
 *
 * Log format in development (pretty-printed):
 * ```
 * [10:30:45] INFO (email-import): Email imported successfully
 *     messageId: "abc123"
 *     requestId: "req_1708343445123_abc7xyz"
 * ```
 */

// Export default logger for simple cases
export default logger
