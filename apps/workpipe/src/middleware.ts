import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

/**
 * WorkPipe Middleware — Portal JWT Auth
 *
 * Auth flow:
 * 1. Check for Portal JWT (orbit_token cookie)
 * 2. On failure → redirect to Portal /api/auth/refresh
 * 3. Portal handles authentication and redirects back with fresh JWT
 *
 * WorkPipe has ZERO knowledge of what auth provider Portal uses.
 * To swap providers: change Portal only.
 */

const PORTAL_TOKEN_COOKIE = 'orbit_token'

/** Routes that don't require authentication */
const PUBLIC_PATHS = new Set([
  '/api/uploadthing',
  '/auth/callback',
  '/api/health',
])

const PUBLIC_PREFIXES = ['/api/internal/', '/site', '/_next']

function isPublicRoute(pathname: string): boolean {
  if (PUBLIC_PATHS.has(pathname)) return true
  return PUBLIC_PREFIXES.some(p => pathname.startsWith(p))
}

/**
 * Check if a Portal JWT cookie exists and hasn't expired.
 * Only decodes the base64 payload — no crypto in edge middleware.
 */
function hasValidPortalToken(req: NextRequest): boolean {
  const token = req.cookies.get(PORTAL_TOKEN_COOKIE)?.value
  if (!token) return false

  try {
    const parts = token.split('.')
    if (parts.length !== 3) return false
    const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString())
    return payload.exp && payload.exp > Date.now() / 1000 - 30
  } catch {
    return false
  }
}

/**
 * Get the public-facing origin.
 * Render resolves req.url to localhost:PORT internally.
 * Use x-forwarded-host header (set by Render's reverse proxy) for the real hostname.
 */
function getPublicOrigin(req: NextRequest): string {
  const proto = req.headers.get('x-forwarded-proto') || 'https'
  const host =
    req.headers.get('x-forwarded-host') ||
    req.headers.get('host') ||
    'workpipe.orbit.example'
  return `${proto}://${host}`
}

/**
 * Redirect to Portal for authentication.
 */
function redirectToPortal(req: NextRequest): NextResponse {
  const portalUrl =
    process.env.NEXT_PUBLIC_PORTAL_URL || 'https://portal.orbit.example'
  const publicOrigin = getPublicOrigin(req)
  const callbackUrl = `${publicOrigin}/auth/callback`
  return NextResponse.redirect(
    new URL(
      `${portalUrl}/api/auth/refresh?redirect_uri=${encodeURIComponent(callbackUrl)}`
    )
  )
}

export default function middleware(req: NextRequest) {
  const url = req.nextUrl
  const searchParams = url.searchParams.toString()
  const pathWithSearchParams = `${url.pathname}${searchParams.length > 0 ? `?${searchParams}` : ''}`

  // --- Subdomain rewriting (agency sites, etc.) ---
  const hostname = req.headers.get('host') || ''
  const domain = process.env.NEXT_PUBLIC_DOMAIN || ''
  const customSubDomain = domain
    ? hostname.split(domain).filter(Boolean)[0]
    : null

  if (customSubDomain) {
    return NextResponse.rewrite(
      new URL(`/${customSubDomain}${pathWithSearchParams}`, req.url)
    )
  }

  // --- Sign-in/sign-up → redirect to Portal ---
  if (
    url.pathname === '/sign-in' ||
    url.pathname.startsWith('/business/sign-in') ||
    url.pathname === '/sign-up' ||
    url.pathname.startsWith('/business/sign-up')
  ) {
    return redirectToPortal(req)
  }

  // --- Public routes → pass through ---
  if (isPublicRoute(url.pathname)) {
    return NextResponse.next()
  }

  // --- Root → smart route ---
  if (url.pathname === '/') {
    if (hasValidPortalToken(req)) {
      const publicOrigin = getPublicOrigin(req)
      return NextResponse.redirect(new URL('/business', publicOrigin))
    }
    return redirectToPortal(req)
  }

  // --- Protected routes: check Portal JWT ---
  if (hasValidPortalToken(req)) {
    return NextResponse.next()
  }

  // No valid token → Portal
  return redirectToPortal(req)
}

export const config = {
  matcher: ['/((?!.+\\.[\\w]+$|_next).*)', '/', '/(api|trpc)(.*)'],
}
