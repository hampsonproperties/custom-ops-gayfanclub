import { z } from 'zod'
import { NextResponse } from 'next/server'
import { badRequest } from '@/lib/api/errors'

/**
 * Validates request body against a Zod schema.
 * Returns typed data on success or a 400 NextResponse on failure.
 */
export function validateBody<T extends z.ZodType>(
  body: unknown,
  schema: T
): { data: z.infer<T>; error?: never } | { data?: never; error: NextResponse } {
  const result = schema.safeParse(body)
  if (!result.success) {
    const issues = result.error.issues.map(i => `${i.path.join('.')}: ${i.message}`)
    return { error: badRequest('Validation failed', issues) }
  }
  return { data: result.data }
}

/**
 * Validates URL params (e.g., route segment params like [id]).
 */
export function validateParams<T extends z.ZodType>(
  params: unknown,
  schema: T
): { data: z.infer<T>; error?: never } | { data?: never; error: NextResponse } {
  const result = schema.safeParse(params)
  if (!result.success) {
    const issues = result.error.issues.map(i => `${i.path.join('.')}: ${i.message}`)
    return { error: badRequest('Invalid parameters', issues) }
  }
  return { data: result.data }
}

/**
 * Validates query string parameters from a URL.
 */
export function validateQuery<T extends z.ZodType>(
  searchParams: URLSearchParams,
  schema: T
): { data: z.infer<T>; error?: never } | { data?: never; error: NextResponse } {
  const obj: Record<string, string> = {}
  searchParams.forEach((value, key) => {
    obj[key] = value
  })
  return validateBody(obj, schema)
}
