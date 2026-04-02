import { NextResponse } from 'next/server'
import { verifyPortalToken, PORTAL_TOKEN_COOKIE } from '@/lib/portal-jwt'

// Force Node.js runtime (jsonwebtoken needs Node crypto APIs)
export const runtime = 'nodejs'

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
  try {
    const url = new URL(req.url)
    const token = url.searchParams.get('token')

    if (!token) {
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
      console.error(
        '[Auth Callback] Token verification failed. JWT_SECRET set:',
        !!process.env.JWT_SECRET
      )
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
      maxAge: payload.exp - Math.floor(Date.now() / 1000),
    })

    return response
  } catch (error) {
    console.error('[Auth Callback] Error:', error)
    return NextResponse.json(
      { error: 'Auth callback failed', details: String(error) },
      { status: 500 }
    )
  }
}
