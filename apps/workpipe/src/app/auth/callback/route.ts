import { NextResponse } from 'next/server'
import { verifyPortalToken, PORTAL_TOKEN_COOKIE } from '@/lib/portal-jwt'

// Force Node.js runtime (jsonwebtoken needs Node crypto APIs)
export const runtime = 'nodejs'

/**
 * Get the public-facing origin.
 * Render resolves req.url to localhost:PORT internally.
 */
function getPublicOrigin(req: Request): string {
  const proto = req.headers.get('x-forwarded-proto') || 'https'
  const host =
    req.headers.get('x-forwarded-host') ||
    req.headers.get('host') ||
    'workpipe.orbit.example'
  return `${proto}://${host}`
}

/**
 * GET /auth/callback?token=<jwt>
 *
 * Token handoff endpoint. Portal redirects users here after authentication.
 */
export async function GET(req: Request) {
  try {
    const url = new URL(req.url)
    const token = url.searchParams.get('token')
    const publicOrigin = getPublicOrigin(req)

    if (!token) {
      const portalUrl =
        process.env.NEXT_PUBLIC_PORTAL_URL || 'https://portal.orbit.example'
      const callbackUrl = `${publicOrigin}/auth/callback`
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
      const callbackUrl = `${publicOrigin}/auth/callback`
      return NextResponse.redirect(
        `${portalUrl}/api/auth/refresh?redirect_uri=${encodeURIComponent(callbackUrl)}`
      )
    }

    // Set the JWT as an HTTP-only cookie and redirect to dashboard
    const response = NextResponse.redirect(new URL('/business', publicOrigin))

    response.cookies.set(PORTAL_TOKEN_COOKIE, token, {
      httpOnly: true,
      secure: true,
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
