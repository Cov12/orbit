import { NextResponse } from 'next/server'
import {
  verifyPortalToken,
  PORTAL_TOKEN_COOKIE,
  type PortalJwtPayload,
} from '@/lib/portal-jwt'
import { db } from '@/lib/db'

// Force Node.js runtime (jsonwebtoken needs Node crypto APIs)
export const runtime = 'nodejs'

/**
 * Self-provision the WorkPipe Business + owner from the Portal JWT so a portal
 * user skips WorkPipe's onboarding form — mirrors how Conductor's portal-callback
 * provisions the company so its native onboarding never fires.
 *
 * Best-effort: any failure is logged and swallowed so it never blocks login
 * (the user just falls back to the onboarding form). Create-if-missing, so an
 * existing business's real details are never overwritten with placeholders.
 * Contact fields (phone/address/...) are intentionally left blank — WorkPipe's
 * non-blocking kickstart checklist guides the owner to complete them in Settings.
 */
async function provisionBusinessFromPortal(
  payload: PortalJwtPayload
): Promise<void> {
  const orgId = payload.org_id
  const email = payload.email
  if (!orgId || !email) return

  try {
    // Owner user, keyed by email (mirrors initUser semantics).
    await db.user.upsert({
      where: { email },
      update: {},
      create: {
        id: payload.sub || undefined,
        email,
        name: payload.name || email,
        avatarUrl: '',
        role: 'BUSINESS_OWNER',
      },
    })

    // Business with id = the Portal org id. Create only when missing.
    const existing = await db.business.findUnique({
      where: { id: orgId },
      select: { id: true },
    })
    if (existing) return

    const portalUrl =
      process.env.NEXT_PUBLIC_PORTAL_URL || 'https://portal.orbit.example'
    await db.business.create({
      data: {
        id: orgId,
        name: payload.org_name || payload.org_slug || 'My Business',
        businessLogo: payload.org_logo || '',
        companyEmail: email,
        companyPhone: '',
        address: '',
        city: '',
        state: '',
        zipCode: '',
        country: '',
        users: { connect: { email } },
        SidebarOption: {
          create: [
            {
              name: 'Calendar',
              icon: 'calendar',
              link: `/business/${orgId}/calendar`,
            },
            { name: 'Dashboard', icon: 'category', link: `/business/${orgId}` },
            {
              name: 'KickStart',
              icon: 'clipboardIcon',
              link: `/business/${orgId}/kickstart`,
            },
            { name: 'Billing', icon: 'payment', link: `${portalUrl}/billing` },
            {
              name: 'Settings',
              icon: 'settings',
              link: `/business/${orgId}/settings`,
            },
            {
              name: 'Sub Accounts',
              icon: 'person',
              link: `/business/${orgId}/all-subaccounts`,
            },
            { name: 'Team', icon: 'shield', link: `/business/${orgId}/team` },
          ],
        },
      },
    })
  } catch (err) {
    console.error('[Auth Callback] business auto-provision failed:', err)
  }
}

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

    // Provision the Business so the user lands in the dashboard rather than the
    // onboarding form (the bypass). Best-effort — never blocks login.
    await provisionBusinessFromPortal(payload)

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
