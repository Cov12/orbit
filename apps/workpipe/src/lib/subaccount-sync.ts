import { cookies } from 'next/headers'

import { db } from '@/lib/db'
import {
  verifyPortalToken,
  PORTAL_TOKEN_COOKIE,
  type PortalJwtPayload,
} from '@/lib/portal-jwt'

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
export async function provisionSubAccountsFromPortal(
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
      // This now runs inside an RSC render (see `syncSubAccountsFromPortal`),
      // so a hung Portal would stall the page rather than just a redirect.
      // The abort surfaces as a rejection that the catch below swallows.
      signal: AbortSignal.timeout(4000),
    })
    if (!res.ok) {
      console.error('[SubAccount Sync] sub-account fetch failed:', res.status)
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
                  name: 'Files',
                  icon: 'database',
                  link: `/subaccount/${sa.id}/files`,
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
            `[SubAccount Sync] sub-account provision failed (${sa.id}):`,
            err
          )
        )
    }
  } catch (err) {
    console.error('[SubAccount Sync] sub-account auto-provision failed:', err)
  }
}

// Per-org throttle for `syncSubAccountsFromPortal`. Module scope, so it lives
// for the life of the server process (and is per-instance — a multi-instance
// deploy just syncs once per instance, which is harmless: the sync is
// create-if-missing).
const SYNC_TTL_MS = 5 * 60 * 1000
const lastSync = new Map<string, number>()
const inFlight = new Map<string, Promise<void>>()

/**
 * On-demand re-pull of the org's Portal sub-accounts, for pages that list them.
 *
 * A sub-account created in Portal *after* the user's WorkPipe session started
 * would otherwise stay invisible until the `orbit_token` cookie was cleared and
 * the /auth/callback handoff re-ran. This reads the same cookie the callback
 * sets and runs the same create-if-missing provisioning.
 *
 * Throttled to one Portal call per org per 5 minutes, with in-flight dedupe so
 * the layout and the page calling it in the same render only hit Portal once.
 * The TTL is stamped even on failure, so a Portal outage can't turn into a
 * fetch on every page load. Never throws — a sync failure must not break the
 * page, which still renders whatever WorkPipe already has locally.
 */
export async function syncSubAccountsFromPortal(): Promise<void> {
  try {
    const token = (await cookies()).get(PORTAL_TOKEN_COOKIE)?.value
    if (!token) return

    // Normally guaranteed by middleware; still possible on clock skew or a
    // token that expired between the middleware check and here.
    const payload = verifyPortalToken(token)
    if (!payload) return

    const orgId = payload.org_id
    if (!orgId) return

    const now = Date.now()
    if (now - (lastSync.get(orgId) ?? 0) < SYNC_TTL_MS) return

    const pending = inFlight.get(orgId)
    if (pending) {
      await pending
      return
    }

    const run = provisionSubAccountsFromPortal(token, payload)
    inFlight.set(orgId, run)
    try {
      await run
    } finally {
      lastSync.set(orgId, Date.now())
      inFlight.delete(orgId)
    }
  } catch (err) {
    console.error('[SubAccount Sync] on-demand sync failed:', err)
  }
}
