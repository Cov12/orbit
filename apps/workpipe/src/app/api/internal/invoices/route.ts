import { NextResponse } from 'next/server'

import { db } from '@/lib/db'
import {
  validateInternalAuth,
  validateSubAccountForBusiness,
} from '@/lib/internal-auth'

const errorResponse = (error: string, code: string, status: number) =>
  NextResponse.json({ error, code }, { status })

/** GET /api/internal/invoices?subAccountId=  — invoice summary (read-only).
 *  Amounts are integer cents in the DB; the response reports dollars (cents/100)
 *  to keep the shape stable for existing dashboard consumers. */
export async function GET(request: Request) {
  try {
    const { businessId } = await validateInternalAuth(request)
    const { searchParams } = new URL(request.url)
    const subAccountId = searchParams.get('subAccountId')

    if (!subAccountId) {
      return errorResponse('subAccountId is required', 'VALIDATION_ERROR', 422)
    }

    await validateSubAccountForBusiness(subAccountId, businessId)

    const invoices = await db.invoice.findMany({
      where: { subAccountId },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        name: true,
        type: true,
        status: true,
        totalDueCents: true,
        dueDate: true,
        createdAt: true,
      },
    })

    const toDollars = (cents: number) => cents / 100

    const now = new Date()
    const soon = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000)

    const count = invoices.length
    const totalDue = toDollars(
      invoices.reduce((sum, inv) => sum + inv.totalDueCents, 0)
    )
    const dueSoonCount = invoices.filter(
      inv => inv.dueDate && inv.dueDate >= now && inv.dueDate <= soon
    ).length
    const recent = invoices.slice(0, 5).map(inv => ({
      id: inv.id,
      name: inv.name,
      type: inv.type,
      status: inv.status,
      totalDue: toDollars(inv.totalDueCents),
      dueDate: inv.dueDate,
    }))

    return NextResponse.json({ count, totalDue, dueSoonCount, recent })
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
