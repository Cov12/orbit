import 'server-only'

import type { Prisma, Tag } from '@prisma/client'
import { v4 } from 'uuid'

import { normalizeEmail } from './contact-normalize'
import { db } from './db'

/**
 * Tenant-unchecked data access.
 *
 * These functions take a sub-account, pipeline or record id and act on it with no ownership
 * check. They exist for callers that authorize by other means: the service-authed
 * `/api/internal/*` routes (validateInternalAuth + validateSubAccountForBusiness) and the
 * guarded server actions in `queries.ts`, which assert ownership first and then call in here.
 *
 * This module must never be marked 'use server'. Every export of a 'use server' module
 * becomes a server action that any browser can call with arbitrary arguments, so an
 * unchecked function exported from one is an open endpoint.
 */

export const loadTicketsWithTags = async (pipelineId: string) => {
  const response = await db.ticket.findMany({
    where: {
      Lane: {
        pipelineId,
      },
    },
    include: { Tags: true, Assigned: true, Customer: true },
  })
  // Convert Decimal to number for client component serialization
  return response.map(ticket => ({
    ...ticket,
    value: ticket.value?.toNumber() ?? null,
  }))
}

// Unguarded read for the service-authed GET /api/internal/pipelines/[id]/tickets
// route, which verifies pipeline→business ownership itself. Do NOT call from
// interactive dashboard code — use getTicketsWithTags.
export const getTicketsWithTagsUnchecked = async (pipelineId: string) => {
  return loadTicketsWithTags(pipelineId)
}

export const loadPipelines = async (subaccountId: string) => {
  const response = await db.pipeline.findMany({
    where: { subAccountId: subaccountId },
    include: {
      Lane: {
        include: { Tickets: true },
      },
    },
  })
  // Convert Decimal values to numbers for client component serialization
  return response.map(pipeline => ({
    ...pipeline,
    Lane: pipeline.Lane.map(lane => ({
      ...lane,
      Tickets: lane.Tickets.map(ticket => ({
        ...ticket,
        value: ticket.value?.toNumber() ?? null,
      })),
    })),
  }))
}

// Unguarded read for the service-authed GET /api/internal/pipelines route, which
// verifies sub-account→business ownership itself via validateSubAccountForBusiness.
// Do NOT call from interactive dashboard code — use getPipelines.
export const getPipelinesUnchecked = async (subaccountId: string) => {
  return loadPipelines(subaccountId)
}

/**
 * Shared contact write path.
 *
 * `Contact` has no unique key on (subAccountId, email) — and prod may already
 * hold duplicates — so dedupe happens here in application code: with no id
 * supplied we look for an existing contact in the same sub-account whose email
 * matches case-insensitively and update that one in place, instead of the old
 * `where: { id: contact.id || v4() }` upsert which always created a new row.
 */
export const persistContact = async (contact: Prisma.ContactUncheckedCreateInput) => {
  const email = normalizeEmail(contact.email)
  const data = { ...contact, ...(email !== undefined && { email }) }

  // Explicit id: caller knows the row it means — keep upsert-by-id behaviour.
  if (contact.id) {
    return db.contact.upsert({
      where: { id: contact.id },
      update: data,
      create: data,
    })
  }

  if (email) {
    const existing = await db.contact.findFirst({
      where: {
        subAccountId: contact.subAccountId,
        email: { equals: email, mode: 'insensitive' },
      },
      select: { id: true },
    })

    if (existing) {
      return db.contact.update({ where: { id: existing.id }, data })
    }
  }

  return db.contact.create({ data })
}

// Unguarded write for callers that authorize by other means: the public live
// funnel contact form (no session — lead capture) and the service-authed
// /api/internal/contacts route (validateInternalAuth + validateSubAccountForBusiness).
// Do NOT call from interactive dashboard code — use upsertContact so the
// session ownership guard applies.
export const upsertContactUnchecked = async (
  contact: Prisma.ContactUncheckedCreateInput
) => {
  return persistContact(contact)
}

export const persistTicket = async (
  ticket: Prisma.TicketUncheckedCreateInput,
  tags: Tag[]
) => {
  let order: number
  if (!ticket.order) {
    const tickets = await db.ticket.findMany({
      where: { laneId: ticket.laneId },
    })
    order = tickets.length
  } else {
    order = ticket.order
  }

  const response = await db.ticket.upsert({
    where: {
      id: ticket.id || v4(),
    },
    update: { ...ticket, Tags: { set: tags } },
    create: { ...ticket, Tags: { connect: tags }, order },
    include: {
      Assigned: true,
      Customer: true,
      Tags: true,
      Lane: true,
    },
  })

  // Convert Decimal to number for client component serialization
  return {
    ...response,
    value: response.value?.toNumber() ?? null,
  }
}

// Unguarded write for the service-authed /api/internal/tickets route, which
// already verifies lane→sub-account→business ownership itself. Do NOT call from
// interactive dashboard code — use upsertTicket so the session guard applies.
export const upsertTicketUnchecked = async (
  ticket: Prisma.TicketUncheckedCreateInput,
  tags: Tag[]
) => {
  return persistTicket(ticket, tags)
}

// Records "a new contact signed up" on a sub-account from a trusted server path (the
// lead-ingest route resolves the sub-account from the form key). Attributed to the
// business's first user, since a funnel visitor has no account. Never throws.
export const recordLeadNotificationUnchecked = async (
  subAccountId: string,
  contactName: string
) => {
  try {
    const subAccount = await db.subAccount.findUnique({
      where: { id: subAccountId },
      select: { businessId: true },
    })
    if (!subAccount) return
    const owner = await db.user.findFirst({
      where: { businessId: subAccount.businessId },
      orderBy: { createdAt: 'asc' },
    })
    if (!owner) return
    await db.notification.create({
      data: {
        notification: `${owner.name} | A New contact signed up | ${contactName}`,
        User: { connect: { id: owner.id } },
        Business: { connect: { id: subAccount.businessId } },
        SubAccount: { connect: { id: subAccountId } },
      },
    })
  } catch (error) {
    console.error('[recordLeadNotificationUnchecked] failed (non-blocking):', error)
  }
}
