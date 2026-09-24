import { NextResponse } from 'next/server'

import { db } from '@/lib/db'
import {
  validateInternalAuth,
  validateSubAccountForBusiness,
} from '@/lib/internal-auth'

const errorResponse = (error: string, code: string, status: number) =>
  NextResponse.json({ error, code }, { status })

/** GET /api/internal/appointments?subAccountId=  — upcoming calendar events (read-only). */
export async function GET(request: Request) {
  try {
    const { businessId } = await validateInternalAuth(request)
    const { searchParams } = new URL(request.url)
    const subAccountId = searchParams.get('subAccountId')

    if (!subAccountId) {
      return errorResponse('subAccountId is required', 'VALIDATION_ERROR', 422)
    }

    await validateSubAccountForBusiness(subAccountId, businessId)

    const now = new Date()
    const where = { subAccountId, start: { gte: now } }
    const [upcoming, upcomingCount] = await db.$transaction([
      db.calendarEvent.findMany({
        where,
        orderBy: { start: 'asc' },
        take: 6,
        select: {
          id: true,
          title: true,
          start: true,
          end: true,
          allDay: true,
          category: true,
        },
      }),
      db.calendarEvent.count({ where }),
    ])

    return NextResponse.json({ upcoming, upcomingCount })
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
