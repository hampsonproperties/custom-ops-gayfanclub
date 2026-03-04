import { NextResponse } from 'next/server'

/**
 * Standard API Error Responses
 *
 * All error responses follow the shape:
 *   { error: string, code: string, details?: string[] }
 *
 * - `error` is the human-readable message (displayed to users)
 * - `code` is the machine-readable error type (for frontend logic)
 * - `details` is optional validation error breakdown
 */

export function badRequest(message: string, details?: string[]) {
  return NextResponse.json(
    { error: message, code: 'BAD_REQUEST', ...(details ? { details } : {}) },
    { status: 400 }
  )
}

export function unauthorized(message = 'Unauthorized') {
  return NextResponse.json(
    { error: message, code: 'UNAUTHORIZED' },
    { status: 401 }
  )
}

export function notFound(message: string) {
  return NextResponse.json(
    { error: message, code: 'NOT_FOUND' },
    { status: 404 }
  )
}

export function conflict(message: string) {
  return NextResponse.json(
    { error: message, code: 'CONFLICT' },
    { status: 409 }
  )
}

export function tooManyRequests(message: string, resetIn?: number) {
  return NextResponse.json(
    { error: message, code: 'RATE_LIMITED', ...(resetIn !== undefined ? { resetIn } : {}) },
    {
      status: 429,
      headers: resetIn !== undefined
        ? { 'Retry-After': String(resetIn) }
        : undefined,
    }
  )
}

export function serverError(message: string) {
  return NextResponse.json(
    { error: message, code: 'SERVER_ERROR' },
    { status: 500 }
  )
}
