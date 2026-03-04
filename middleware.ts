import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import { checkRateLimit, RATE_LIMITS } from '@/lib/api/rate-limit'
import { unauthorized, tooManyRequests } from '@/lib/api/errors'

function getClientIp(request: NextRequest): string {
  return request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
    || request.headers.get('x-real-ip')
    || 'unknown'
}

export async function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname

  // ── Rate limit unauthenticated paths early (before Supabase call) ──
  // Webhooks and cron jobs don't use user sessions, so rate limit by IP
  if (pathname.startsWith('/api/webhooks/shopify') || pathname.startsWith('/api/webhooks/email')) {
    const ip = getClientIp(request)
    const result = checkRateLimit(`webhook:${ip}`, RATE_LIMITS.webhook)
    if (!result.allowed) {
      return tooManyRequests('Rate limit exceeded', result.resetIn)
    }
  } else if (pathname.startsWith('/api/cron/')) {
    const ip = getClientIp(request)
    const result = checkRateLimit(`cron:${ip}`, RATE_LIMITS.cron)
    if (!result.allowed) {
      return tooManyRequests('Rate limit exceeded', result.resetIn)
    }
  } else if (pathname.startsWith('/api/approve-proof') || pathname.startsWith('/api/request-changes')) {
    // Customer-facing pages — rate limit by IP
    const ip = getClientIp(request)
    const result = checkRateLimit(`public:${ip}`, RATE_LIMITS.api)
    if (!result.allowed) {
      return tooManyRequests('Rate limit exceeded', result.resetIn)
    }
  }

  // Login page — rate limit by IP to slow brute force
  if (pathname.startsWith('/login')) {
    const ip = getClientIp(request)
    const result = checkRateLimit(`login:${ip}`, RATE_LIMITS.login)
    if (!result.allowed) {
      return tooManyRequests('Too many login attempts. Please wait.', result.resetIn)
    }
  }

  // ── Supabase session refresh ──
  let supabaseResponse = NextResponse.next({
    request,
  })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({
            request,
          })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  const {
    data: { user },
  } = await supabase.auth.getUser()

  // ── Authentication checks ──
  // Routes that handle their own authentication (not user sessions)
  // Be specific — /api/webhooks/reprocess is a staff action and needs session auth
  const selfAuthPaths = [
    '/api/webhooks/shopify', // Shopify HMAC signature verification
    '/api/webhooks/email',   // Microsoft Graph clientState validation
    '/api/cron/',            // CRON_SECRET bearer token
    '/api/approve-proof',    // Customer-facing JWT token
    '/api/request-changes',  // Customer-facing JWT token
  ]

  if (!user) {
    if (pathname.startsWith('/api')) {
      // API routes with their own auth mechanisms — let them through
      const isSelfAuth = selfAuthPaths.some(path => pathname.startsWith(path))
      if (!isSelfAuth) {
        return unauthorized('Authentication required')
      }
    } else if (!pathname.startsWith('/login')) {
      // Page routes — redirect to login
      const url = request.nextUrl.clone()
      url.pathname = '/login'
      return NextResponse.redirect(url)
    }
  }

  // ── Rate limit authenticated API routes by user ID ──
  if (user && pathname.startsWith('/api')) {
    const tier = pathname.startsWith('/api/search')
      ? RATE_LIMITS.search
      : RATE_LIMITS.api
    const result = checkRateLimit(`user:${user.id}`, tier)
    if (!result.allowed) {
      return tooManyRequests('Rate limit exceeded. Please slow down.', result.resetIn)
    }
  }

  // Redirect to dashboard if already logged in and trying to access login
  if (user && pathname.startsWith('/login')) {
    const url = request.nextUrl.clone()
    url.pathname = '/dashboard'
    return NextResponse.redirect(url)
  }

  return supabaseResponse
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public files
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
