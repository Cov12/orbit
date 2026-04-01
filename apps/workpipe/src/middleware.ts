import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

/**
 * WorkPipe Middleware — Dual Auth Strategy
 *
 * Auth priority:
 * 1. Portal JWT (orbit_token cookie) — primary path, provider-agnostic
 * 2. Clerk session — legacy fallback (will be removed when Clerk is fully decoupled)
 *
 * On auth failure for protected routes:
 * → Redirect to Portal /api/auth/refresh (NOT to Clerk sign-in)
 * → Portal handles re-authentication with whatever provider it uses
 * → Portal redirects back to /auth/callback with fresh JWT
 */

const PORTAL_TOKEN_COOKIE = 'orbit_token'

// Public routes — no auth required
const isPublicRoute = createRouteMatcher([
  '/',
  '/site',
  '/site/(.*)',
  '/api/uploadthing',
  '/api/internal/(.*)',
  '/auth/callback',
  '/sign-in(.*)',
  '/sign-up(.*)',
  '/business/sign-in(.*)',
  '/business/sign-up(.*)',
])

/**
 * Check if a Portal JWT cookie exists and hasn't expired.
 * Note: Full signature verification happens server-side in route handlers.
 * Middleware only does a quick expiry check (JWT is base64, we can peek at exp).
 */
function hasValidPortalToken(req: NextRequest): boolean {
  const token = req.cookies.get(PORTAL_TOKEN_COOKIE)?.value
  if (!token) return false

  try {
    // Decode JWT payload without verification (middleware can't do crypto)
    const parts = token.split('.')
    if (parts.length !== 3) return false
    const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString())
    // Check expiry with 30s buffer
    return payload.exp && payload.exp > Date.now() / 1000 - 30
  } catch {
    return false
  }
}

/**
 * Redirect to Portal for authentication.
 */
function redirectToPortal(req: NextRequest): NextResponse {
  const portalUrl =
    process.env.NEXT_PUBLIC_PORTAL_URL || 'https://portal.orbit.example'
  const callbackUrl = `${req.nextUrl.origin}/auth/callback`
  return NextResponse.redirect(
    new URL(
      `${portalUrl}/api/auth/refresh?redirect_uri=${encodeURIComponent(callbackUrl)}`
    )
  )
}

export default clerkMiddleware(async (auth, req) => {
  const url = req.nextUrl
  const searchParams = url.searchParams.toString()
  const hostname = req.headers
  const pathWithSearchParams = `${url.pathname}${searchParams.length > 0 ? `?${searchParams}` : ''}`

  // --- Subdomain rewriting (agency sites, etc.) ---
  const customSubDomain = hostname
    .get('host')
    ?.split(`${process.env.NEXT_PUBLIC_DOMAIN}`)
    .filter(Boolean)[0]

  if (customSubDomain) {
    return NextResponse.rewrite(
      new URL(`/${customSubDomain}${pathWithSearchParams}`, req.url)
    )
  }

  // --- Auth routes → redirect to Portal (single entry point) ---
  if (
    url.pathname === '/sign-in' ||
    url.pathname.startsWith('/business/sign-in')
  ) {
    return redirectToPortal(req)
  }

  if (
    url.pathname === '/sign-up' ||
    url.pathname.startsWith('/business/sign-up')
  ) {
    return redirectToPortal(req)
  }

  // --- Public routes → no auth needed ---
  if (isPublicRoute(req)) {
    // Site root / landing
    if (
      url.pathname === '/' ||
      (url.pathname === '/site' && url.host === process.env.NEXT_PUBLIC_DOMAIN)
    ) {
      return NextResponse.rewrite(new URL('/site', req.url))
    }
    return NextResponse.next()
  }

  // --- Protected routes: check auth ---

  // Priority 1: Portal JWT
  if (hasValidPortalToken(req)) {
    // User has a valid Portal token — allow through
    if (
      url.pathname.startsWith('/business') ||
      url.pathname.startsWith('/subaccount')
    ) {
      return NextResponse.rewrite(new URL(`${pathWithSearchParams}`, req.url))
    }
    return NextResponse.next()
  }

  // Priority 2: Clerk session (legacy fallback)
  try {
    const { userId } = await auth()
    if (userId) {
      // Clerk session is valid — allow through
      if (
        url.pathname.startsWith('/business') ||
        url.pathname.startsWith('/subaccount')
      ) {
        return NextResponse.rewrite(new URL(`${pathWithSearchParams}`, req.url))
      }
      return NextResponse.next()
    }
  } catch {
    // Clerk auth failed — fall through to redirect
  }

  // Neither auth method worked → redirect to Portal
  return redirectToPortal(req)
})

export const config = {
  matcher: ['/((?!.+\\.[\\w]+$|_next).*)', '/', '/(api|trpc)(.*)'],
}
