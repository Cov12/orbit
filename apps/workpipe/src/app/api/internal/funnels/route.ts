import { NextResponse } from 'next/server'

import { db } from '@/lib/db'
import {
  validateInternalAuth,
  validateSubAccountForBusiness,
} from '@/lib/internal-auth'

const errorResponse = (error: string, code: string, status: number) =>
  NextResponse.json({ error, code }, { status })

/** GET /api/internal/funnels?subAccountId=  — funnel summary (read-only). */
export async function GET(request: Request) {
  try {
    const { businessId } = await validateInternalAuth(request)
    const { searchParams } = new URL(request.url)
    const subAccountId = searchParams.get('subAccountId')

    if (!subAccountId) {
      return errorResponse('subAccountId is required', 'VALIDATION_ERROR', 422)
    }

    await validateSubAccountForBusiness(subAccountId, businessId)

    const funnels = await db.funnel.findMany({
      where: { subAccountId },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        name: true,
        published: true,
        createdAt: true,
        FunnelPages: { select: { visits: true } },
      },
    })

    const visitsOf = (f: { FunnelPages: { visits: number }[] }) =>
      f.FunnelPages.reduce((v, p) => v + (p.visits ?? 0), 0)

    const count = funnels.length
    const publishedCount = funnels.filter(f => f.published).length
    const totalVisits = funnels.reduce((s, f) => s + visitsOf(f), 0)
    const recent = funnels.slice(0, 5).map(f => ({
      id: f.id,
      name: f.name,
      published: f.published,
      visits: visitsOf(f),
    }))

    return NextResponse.json({ count, publishedCount, totalVisits, recent })
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
