import { NextResponse } from 'next/server'

import { db } from '@/lib/db'
import {
  validateInternalAuth,
  validateSubAccountForBusiness,
} from '@/lib/internal-auth'

const errorResponse = (error: string, code: string, status: number) =>
  NextResponse.json({ error, code }, { status })

export async function GET(request: Request) {
  try {
    const { businessId } = await validateInternalAuth(request)
    const { searchParams } = new URL(request.url)
    const subAccountId = searchParams.get('subAccountId')

    if (!subAccountId) {
      return errorResponse('subAccountId is required', 'VALIDATION_ERROR', 422)
    }

    await validateSubAccountForBusiness(subAccountId, businessId)

    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)

    const [contactTotal, contactRecent, pipelineCount, lanes] = await db.$transaction([
      db.contact.count({ where: { subAccountId } }),
      db.contact.count({
        where: { subAccountId, createdAt: { gte: thirtyDaysAgo } },
      }),
      db.pipeline.count({ where: { subAccountId } }),
      db.lane.findMany({
        where: { Pipeline: { subAccountId } },
        select: {
          name: true,
          Tickets: {
            select: {
              value: true,
            },
          },
        },
      }),
    ])

    const ticketTotal = lanes.reduce((count, lane) => count + lane.Tickets.length, 0)
    const totalValue = lanes.reduce(
      (sum, lane) =>
        sum + lane.Tickets.reduce((laneSum, ticket) => laneSum + (ticket.value?.toNumber() ?? 0), 0),
      0
    )

    const byLane = lanes.reduce<Record<string, number>>((acc, lane) => {
      acc[lane.name] = lane.Tickets.length
      return acc
    }, {})

    return NextResponse.json({
      contacts: { total: contactTotal, recentCount: contactRecent },
      tickets: { total: ticketTotal, totalValue, byLane },
      pipelines: { count: pipelineCount },
    })
  } catch (err) {
    if (err instanceof Error) {
      if (err.message === 'UNAUTHORIZED') {
        return errorResponse('Unauthorized', 'UNAUTHORIZED', 401)
      }
      if (err.message === 'FORBIDDEN') {
        return errorResponse('Forbidden', 'UNAUTHORIZED', 403)
      }
      if (err.message === 'NOT_FOUND') {
        return errorResponse('SubAccount not found', 'NOT_FOUND', 404)
      }
    }

    return errorResponse('Internal server error', 'INTERNAL_ERROR', 500)
  }
}
