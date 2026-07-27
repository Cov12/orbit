import { NextResponse } from 'next/server'

import { db } from '@/lib/db'
import {
  validateInternalAuth,
  validateSubAccountForBusiness,
} from '@/lib/internal-auth'

const errorResponse = (error: string, code: string, status: number) =>
  NextResponse.json({ error, code }, { status })

/** GET /api/internal/invoices?subAccountId=  — invoice summary (read-only).
 *  totalDue is stored as a String, so it is parsed and summed in-app (not via SQL). */
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
        totalDue: true,
        dueDate: true,
        createdAt: true,
      },
    })

    const toNumber = (v: string | null) => {
      const n = parseFloat((v ?? '').replace(/[^0-9.-]/g, ''))
      return Number.isFinite(n) ? n : 0
    }

    const now = new Date()
    const soon = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000)

    const count = invoices.length
    const totalDue = invoices.reduce(
      (sum, inv) => sum + toNumber(inv.totalDue),
      0
    )
    const dueSoonCount = invoices.filter(
      inv => inv.dueDate && inv.dueDate >= now && inv.dueDate <= soon
    ).length
    const recent = invoices.slice(0, 5).map(inv => ({
      id: inv.id,
      name: inv.name,
      type: inv.type,
      totalDue: toNumber(inv.totalDue),
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
