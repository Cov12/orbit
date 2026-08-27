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

    if (existing) {
      // Attach the user to the org whose token they just authenticated with.
      // `User.businessId` is a single nullable FK (no membership table), so it
      // *is* the user's active workspace. Provisioning used to early-return
      // here, leaving businessId pinned to whichever org's Business row was
      // created last, while the JWT `org_id` follows Portal's active
      // workspace — the two diverged and `assertOwnsBusiness` 500'd the
      // business page. Re-pointing it on every callback makes re-launching
      // WorkPipe from Portal switch the active workspace. The business was
      // seeded with its SidebarOptions when created, and the sidebar reads
      // `user.Business.SidebarOption`, so the links follow automatically.
      await db.user.update({
        where: { email },
        data: { businessId: orgId },
      })
      return
    }

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
        // Also points User.businessId at this org (the active-workspace FK).
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

type PortalSubAccount = { id: string; name: string; slug: string }

/**
 * Mirror Portal's sub-accounts into WorkPipe's own DB so they appear in the
 * dashboard. WorkPipe is on a separate database from Portal and owns data
 * (funnels/contacts/pipelines) that FKs to SubAccount, so it must materialise
 * local rows. Portal is the source of truth for sub-account identity; we PULL
 * the list from its JWT-authed endpoint (no Clerk session needed server-side).
 *
 * Best-effort and create-if-missing: failures never block login, and an
 * existing sub-account's real details are never overwritten with placeholders.
 * Contact fields are left blank (completed later in WorkPipe), mirroring how the
 * Business is provisioned. Each new sub-account gets the same Permissions,
 * onboarding Pipeline, and SidebarOptions as the native `upsertSubAccount`.
 */
async function provisionSubAccountsFromPortal(
  token: string,
  payload: PortalJwtPayload
): Promise<void> {
  const orgId = payload.org_id
  const email = payload.email
  if (!orgId || !email) return

  try {
    const portalUrl =
      process.env.NEXT_PUBLIC_PORTAL_URL || 'https://portal.orbit.example'
    const res = await fetch(`${portalUrl}/api/subaccounts`, {
      headers: { Authorization: `Bearer ${token}` },
      cache: 'no-store',
    })
    if (!res.ok) {
      console.error('[Auth Callback] sub-account fetch failed:', res.status)
      return
    }

    const { subAccounts = [] } = (await res.json()) as {
      subAccounts?: PortalSubAccount[]
    }
    if (subAccounts.length === 0) return

    // Create-if-missing only — never touch existing rows.
    const existing = await db.subAccount.findMany({
      where: { id: { in: subAccounts.map(s => s.id) } },
      select: { id: true },
    })
    const existingIds = new Set(existing.map(e => e.id))

    for (const sa of subAccounts) {
      if (existingIds.has(sa.id)) continue
      await db.subAccount
        .create({
          data: {
            id: sa.id,
            businessId: orgId,
            name: sa.name,
            subAccountLogo: '',
            companyEmail: email,
            companyPhone: '',
            address: '',
            city: '',
            zipCode: '',
            state: '',
            country: '',
            Permissions: { create: { access: true, email } },
            Pipeline: { create: { name: 'Sub Account Onboarding' } },
            SidebarOption: {
              create: [
                {
                  name: 'Dashboard',
                  icon: 'category',
                  link: `/subaccount/${sa.id}`,
                },
                {
                  name: 'Kick Start',
                  icon: 'clipboardIcon',
                  link: `/subaccount/${sa.id}/kickstart`,
                },
                {
                  name: 'Funnels',
                  icon: 'pipelines',
                  link: `/subaccount/${sa.id}/funnels`,
                },
                {
                  name: 'Media',
                  icon: 'database',
                  link: `/subaccount/${sa.id}/media`,
                },
                {
                  name: 'Automations',
                  icon: 'chip',
                  link: `/subaccount/${sa.id}/automations`,
                },
                {
                  name: 'Pipelines',
                  icon: 'flag',
                  link: `/subaccount/${sa.id}/pipelines`,
                },
                {
                  name: 'Contacts',
                  icon: 'person',
                  link: `/subaccount/${sa.id}/contacts`,
                },
                {
                  name: 'Calendar',
                  icon: 'calendar',
                  link: `/subaccount/${sa.id}/calendar`,
                },
                {
                  name: 'Services',
                  icon: 'clipboardIcon',
                  link: `/subaccount/${sa.id}/services`,
                },
                {
                  name: 'Invoices',
                  icon: 'receipt',
                  link: `/subaccount/${sa.id}/invoices`,
                },
                {
                  name: 'Documents',
                  icon: 'database',
                  link: `/subaccount/${sa.id}/documents`,
                },
                {
                  name: 'Settings',
                  icon: 'settings',
                  link: `/subaccount/${sa.id}/settings`,
                },
              ],
            },
          },
        })
        .catch((err: unknown) =>
          console.error(
            `[Auth Callback] sub-account provision failed (${sa.id}):`,
            err
          )
        )
    }
  } catch (err) {
    console.error('[Auth Callback] sub-account auto-provision failed:', err)
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

    // Mirror the org's Portal sub-accounts into WorkPipe so they show up in the
    // dashboard. Runs after the Business (and owner User) exist. Best-effort.
    await provisionSubAccountsFromPortal(token, payload)

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
