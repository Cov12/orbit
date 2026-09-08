import { randomBytes } from 'crypto'

import { db } from './db'

/**
 * Auto-provision the public lead form backing a funnel's contact form
 * (issue #54 phase 4a).
 *
 * The live funnel form posts to /api/forms/[formKey]/submit, which resolves
 * the owning sub-account from the LeadForm row — so every funnel needs a key
 * before its first render. Minting it lazily here keeps existing funnels
 * working without a migration or a form-builder UI.
 *
 * Deliberately unguarded (no `assertOwnsSubAccount`, unlike `createLeadForm`):
 * this runs on the anonymous public render path, and the funnel — and with it
 * `subAccountId` — is resolved server-side from `getDomainContent`, never from
 * client input. Everything is wrapped in try/catch because a provisioning
 * failure must never take down a live funnel page; the caller falls back to
 * the legacy contact path on `null`.
 */
export async function ensureFunnelLeadForm(funnel: {
  id: string
  subAccountId: string
  name: string
}): Promise<string | null> {
  try {
    const existing = await db.leadForm.findFirst({
      where: { subAccountId: funnel.subAccountId, funnelId: funnel.id },
      select: { key: true },
    })
    if (existing) return existing.key

    const created = await db.leadForm.create({
      data: {
        key: randomBytes(24).toString('base64url'),
        name: `${funnel.name} — Contact Form`,
        subAccountId: funnel.subAccountId,
        funnelId: funnel.id,
      },
      select: { key: true },
    })
    return created.key
  } catch (error) {
    console.error('[ensureFunnelLeadForm] failed (non-blocking):', error)
    return null
  }
}
