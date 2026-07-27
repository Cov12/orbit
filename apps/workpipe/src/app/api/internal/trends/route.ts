import { NextResponse } from 'next/server'

import { db } from '@/lib/db'
import {
  validateInternalAuth,
  validateSubAccountForBusiness,
} from '@/lib/internal-auth'

const errorResponse = (error: string, code: string, status: number) =>
  NextResponse.json({ error, code }, { status })

/** UTC day key (YYYY-MM-DD). */
const dayKey = (d: Date) => d.toISOString().slice(0, 10)

/**
 * GET /api/internal/trends?subAccountId=&days=30  — daily counts of new contacts,
 * deals (tickets) and invoices over the window. Read-only. `days` is clamped to 1..90.
 * Buckets are built for EVERY day in the window (zero-filled) so the series is contiguous.
 */
export async function GET(request: Request) {
  try {
    const { businessId } = await validateInternalAuth(request)
    const { searchParams } = new URL(request.url)
    const subAccountId = searchParams.get('subAccountId')

    if (!subAccountId) {
      return errorResponse('subAccountId is required', 'VALIDATION_ERROR', 422)
    }

    let days = Number(searchParams.get('days') ?? '30')
    if (!Number.isFinite(days) || days < 1) days = 30
    days = Math.min(Math.floor(days), 90)

    await validateSubAccountForBusiness(subAccountId, businessId)

    const start = new Date()
    start.setUTCHours(0, 0, 0, 0)
    start.setUTCDate(start.getUTCDate() - (days - 1))

    const [contacts, tickets, invoices] = await Promise.all([
      db.contact.findMany({
        where: { subAccountId, createdAt: { gte: start } },
        select: { createdAt: true },
      }),
      db.ticket.findMany({
        where: {
          Lane: { Pipeline: { subAccountId } },
          createdAt: { gte: start },
        },
        select: { createdAt: true },
      }),
      db.invoice.findMany({
        where: { subAccountId, createdAt: { gte: start } },
        select: { createdAt: true },
      }),
    ])

    // Zero-filled contiguous day buckets.
    const buckets = new Map<
      string,
      { contacts: number; deals: number; invoices: number }
    >()
    for (let i = 0; i < days; i++) {
      const d = new Date(start)
      d.setUTCDate(start.getUTCDate() + i)
      buckets.set(dayKey(d), { contacts: 0, deals: 0, invoices: 0 })
    }

    const bump = (
      createdAt: Date,
      field: 'contacts' | 'deals' | 'invoices'
    ) => {
      const b = buckets.get(dayKey(new Date(createdAt)))
      if (b) b[field] += 1
    }
    contacts.forEach(c => bump(c.createdAt, 'contacts'))
    tickets.forEach(t => bump(t.createdAt, 'deals'))
    invoices.forEach(inv => bump(inv.createdAt, 'invoices'))

    const series = Array.from(buckets.entries()).map(([date, v]) => ({
      date,
      ...v,
    }))
    const totals = series.reduce(
      (acc, d) => ({
        contacts: acc.contacts + d.contacts,
        deals: acc.deals + d.deals,
        invoices: acc.invoices + d.invoices,
      }),
      { contacts: 0, deals: 0, invoices: 0 }
    )

    return NextResponse.json({ days, series, totals })
  } catch (err) {
    if (err instanceof Error) {
      if (err.message === 'UNAUTHORIZED')
        return errorResponse('Unauthorized', 'UNAUTHORIZED', 401)
      if (err.message === 'FORBIDDEN')
        return errorResponse('Forbidden', 'UNAUTHORIZED', 403)
      if (err.message === 'NOT_FOUND')
        return errorResponse('SubAccount not found', 'NOT_FOUND', 404)
    }
    return errorResponse('Internal server error', 'INTERNAL_ERROR', 500)
  }
}
