import 'server-only'

import type { Role } from '@prisma/client'

import { getAuthContext } from './auth'
import { db } from './db'

/**
 * Ownership guards for tenant-scoped server actions.
 *
 * The interactive server actions in `queries.ts` historically acted on a
 * client-supplied id with no check that the caller's org owns it (IDOR — see
 * issue #44). These helpers close that gap: they derive the caller's business
 * from the *session* (never a client argument) and confirm the target resource
 * belongs to it, throwing `ForbiddenError` otherwise.
 *
 * The tenant root is the Business: `getAuthContext().orgId` is the Portal
 * org id, which equals `Business.id`. Every resource resolves to a
 * `SubAccount`, and `SubAccount.businessId` must match the caller's org — the
 * same boundary the `/api/internal/*` service API enforces via
 * `validateSubAccountForBusiness`.
 */
export class ForbiddenError extends Error {
  constructor(message = 'Not authorized for this resource') {
    super(message)
    this.name = 'ForbiddenError'
  }
}

/** The caller's business id (== Portal org_id) from the session, or throw. */
async function requireBusinessId(): Promise<string> {
  const { orgId } = await getAuthContext()
  if (!orgId) throw new ForbiddenError('Not authenticated')
  return orgId
}

/** Assert the caller owns this business (i.e. it is their own org). */
export async function assertOwnsBusiness(businessId: string): Promise<void> {
  const orgId = await requireBusinessId()
  if (businessId !== orgId) throw new ForbiddenError()
}

/** Assert the sub-account belongs to the caller's business. */
export async function assertOwnsSubAccount(
  subAccountId: string
): Promise<void> {
  const orgId = await requireBusinessId()
  const sa = await db.subAccount.findUnique({
    where: { id: subAccountId },
    select: { businessId: true },
  })
  if (!sa || sa.businessId !== orgId) throw new ForbiddenError()
}

// Resource guards resolve the owning sub-account, then defer to
// assertOwnsSubAccount (which enforces the business boundary against the session).

export async function assertOwnsPipeline(pipelineId: string): Promise<void> {
  const p = await db.pipeline.findUnique({
    where: { id: pipelineId },
    select: { subAccountId: true },
  })
  if (!p) throw new ForbiddenError()
  await assertOwnsSubAccount(p.subAccountId)
}

export async function assertOwnsLane(laneId: string): Promise<void> {
  const lane = await db.lane.findUnique({
    where: { id: laneId },
    select: { Pipeline: { select: { subAccountId: true } } },
  })
  if (!lane) throw new ForbiddenError()
  await assertOwnsSubAccount(lane.Pipeline.subAccountId)
}

export async function assertOwnsTicket(ticketId: string): Promise<void> {
  const ticket = await db.ticket.findUnique({
    where: { id: ticketId },
    select: {
      Lane: { select: { Pipeline: { select: { subAccountId: true } } } },
    },
  })
  if (!ticket) throw new ForbiddenError()
  await assertOwnsSubAccount(ticket.Lane.Pipeline.subAccountId)
}

export async function assertOwnsMedia(mediaId: string): Promise<void> {
  const m = await db.media.findUnique({
    where: { id: mediaId },
    select: { subAccountId: true },
  })
  if (!m) throw new ForbiddenError()
  await assertOwnsSubAccount(m.subAccountId)
}

export async function assertOwnsTag(tagId: string): Promise<void> {
  const t = await db.tag.findUnique({
    where: { id: tagId },
    select: { subAccountId: true },
  })
  if (!t) throw new ForbiddenError()
  await assertOwnsSubAccount(t.subAccountId)
}

export async function assertOwnsContact(contactId: string): Promise<void> {
  const c = await db.contact.findUnique({
    where: { id: contactId },
    select: { subAccountId: true },
  })
  if (!c) throw new ForbiddenError()
  await assertOwnsSubAccount(c.subAccountId)
}

export async function assertOwnsInvoice(invoiceId: string): Promise<void> {
  const inv = await db.invoice.findUnique({
    where: { id: invoiceId },
    select: { subAccountId: true },
  })
  if (!inv) throw new ForbiddenError()
  await assertOwnsSubAccount(inv.subAccountId)
}

export async function assertOwnsFunnel(funnelId: string): Promise<void> {
  const f = await db.funnel.findUnique({
    where: { id: funnelId },
    select: { subAccountId: true },
  })
  if (!f) throw new ForbiddenError()
  await assertOwnsSubAccount(f.subAccountId)
}

export async function assertOwnsFunnelPage(
  funnelPageId: string
): Promise<void> {
  const fp = await db.funnelPage.findUnique({
    where: { id: funnelPageId },
    select: { Funnel: { select: { subAccountId: true } } },
  })
  if (!fp) throw new ForbiddenError()
  await assertOwnsSubAccount(fp.Funnel.subAccountId)
}

// ---------------------------------------------------------------------------
// User-management guards (#44 PR-B).
//
// User administration is privileged: the caller must be an owner/admin of the
// business (the Portal role claim), and the target must belong to that same
// business. The Portal role claim is OWNER/ADMIN/MEMBER; the WorkPipe User.role
// is a separate enum (BUSINESS_OWNER/…).
// ---------------------------------------------------------------------------

/** The caller's business id, requiring an owner/admin role, or throw. */
async function requireBusinessAdmin(): Promise<string> {
  const { orgId, role } = await getAuthContext()
  if (!orgId) throw new ForbiddenError('Not authenticated')
  if (role !== 'OWNER' && role !== 'ADMIN') {
    throw new ForbiddenError('Requires business owner or admin')
  }
  return orgId
}

/**
 * The caller's own business id, for editing that business's details: requires an owner/admin
 * role. Returns the id from the session so callers never trust a client-supplied one.
 */
export async function requireBusinessEditor(): Promise<string> {
  return requireBusinessAdmin()
}

/** Assert the caller (owner/admin) manages the target user's business. */
export async function assertManagesUser(userId: string): Promise<void> {
  const orgId = await requireBusinessAdmin()
  const u = await db.user.findUnique({
    where: { id: userId },
    select: { businessId: true },
  })
  if (!u || u.businessId !== orgId) throw new ForbiddenError()
}

/**
 * Authorize an updateUser call. A user may edit their OWN record; editing any
 * other user requires admin. A role change requires admin, and promotion to
 * BUSINESS_OWNER requires the caller to be an owner. `nextRole` is the role in
 * the update payload (undefined if unchanged/absent); it only gates when it
 * actually differs from the target's current role.
 */
export async function assertCanUpdateUser(
  targetEmail: string,
  nextRole: Role | undefined
): Promise<void> {
  const { userId, orgId, role } = await getAuthContext()
  if (!orgId) throw new ForbiddenError('Not authenticated')
  const target = await db.user.findUnique({
    where: { email: targetEmail },
    select: { id: true, businessId: true, role: true },
  })
  if (!target || target.businessId !== orgId) throw new ForbiddenError()

  const isAdmin = role === 'OWNER' || role === 'ADMIN'
  const isSelf = target.id === userId
  if (!isSelf && !isAdmin) throw new ForbiddenError()

  if (nextRole !== undefined && nextRole !== target.role) {
    if (!isAdmin) throw new ForbiddenError('Only an admin can change a role')
    if (nextRole === 'BUSINESS_OWNER' && role !== 'OWNER') {
      throw new ForbiddenError('Only an owner can grant owner')
    }
  }
}

/**
 * Authorize a sub-account permission grant (owner/admin only). Guards the
 * sub-account being granted, and — on the update path — the existing row's
 * sub-account too, so a foreign permission row can't be flipped by id.
 */
export async function assertCanManagePermissions(
  subAccountId: string,
  permissionId?: string
): Promise<void> {
  await requireBusinessAdmin()
  await assertOwnsSubAccount(subAccountId)
  if (permissionId) {
    const p = await db.permissions.findUnique({
      where: { id: permissionId },
      select: { subAccountId: true },
    })
    if (p) await assertOwnsSubAccount(p.subAccountId)
  }
}

/**
 * Authorize an upsertSubAccount call: the caller must own the target business,
 * and if a sub-account with this id already exists it must already belong to
 * that business (no cross-business hijack/move by reusing an id).
 */
export async function assertCanUpsertSubAccount(
  subAccountId: string,
  businessId: string
): Promise<void> {
  await assertOwnsBusiness(businessId)
  const existing = await db.subAccount.findUnique({
    where: { id: subAccountId },
    select: { businessId: true },
  })
  if (existing && existing.businessId !== businessId) {
    throw new ForbiddenError()
  }
}
