import 'server-only'

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
