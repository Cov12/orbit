import { NextResponse } from 'next/server'
import { verifyPortalToken, PORTAL_TOKEN_COOKIE } from '@/lib/portal-jwt'

/**
 * GET /auth/callback?token=<jwt>
 *
 * Token handoff endpoint. Portal redirects users here after authentication.
 *
 * Flow:
 * 1. Portal authenticates user (via Clerk or whatever provider)
 * 2. Portal generates JWT and redirects: /auth/callback?token=<jwt>
 * 3. This endpoint validates the JWT
 * 4. Sets an HTTP-only cookie with the token
 * 5. Redirects to /business (the main app)
 *
 * Security:
 * - Token is validated before setting cookie
 * - Cookie is HTTP-only (no JS access)
 * - Cookie is Secure (HTTPS only)
 * - SameSite=Lax (allows redirect-based flow)
 */
export async function GET(req: Request) {
  const url = new URL(req.url)
  const token = url.searchParams.get('token')

  if (!token) {
    // No token — redirect to Portal for authentication
    const portalUrl =
      process.env.NEXT_PUBLIC_PORTAL_URL || 'https://portal.orbit.example'
    const callbackUrl = `${url.origin}/auth/callback`
    return NextResponse.redirect(
      `${portalUrl}/api/auth/refresh?redirect_uri=${encodeURIComponent(callbackUrl)}`
    )
  }

  // Validate the token
  const payload = verifyPortalToken(token)

  if (!payload) {
    // Invalid or expired token — redirect to Portal for fresh auth
    const portalUrl =
      process.env.NEXT_PUBLIC_PORTAL_URL || 'https://portal.orbit.example'
    const callbackUrl = `${url.origin}/auth/callback`
    return NextResponse.redirect(
      `${portalUrl}/api/auth/refresh?redirect_uri=${encodeURIComponent(callbackUrl)}`
    )
  }

  // Set the JWT as an HTTP-only cookie
  const response = NextResponse.redirect(new URL('/business', req.url))

  response.cookies.set(PORTAL_TOKEN_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    // Match the JWT expiry (1 hour from Portal)
    maxAge: payload.exp - Math.floor(Date.now() / 1000),
  })

  return response
}
