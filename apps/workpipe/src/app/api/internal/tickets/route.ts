import { Tag } from '@prisma/client'
import { NextResponse } from 'next/server'

import { db } from '@/lib/db'
import { validateInternalAuth } from '@/lib/internal-auth'
import { upsertTicketUnchecked } from '@/lib/queries-internal'

const errorResponse = (error: string, code: string, status: number) =>
  NextResponse.json({ error, code }, { status })

export async function POST(request: Request) {
  try {
    const { businessId } = await validateInternalAuth(request)
    const body = await request.json()

    const laneId = typeof body.laneId === 'string' ? body.laneId : ''
    const name = typeof body.name === 'string' ? body.name.trim() : ''

    if (!laneId || !name) {
      return errorResponse(
        'laneId and name are required',
        'VALIDATION_ERROR',
        422
      )
    }

    const lane = await db.lane.findUnique({
      where: { id: laneId },
      include: {
        Pipeline: {
          include: {
            SubAccount: {
              select: { businessId: true, id: true },
            },
          },
        },
      },
    })

    if (!lane) {
      return errorResponse('Lane not found', 'NOT_FOUND', 404)
    }

    if (lane.Pipeline.SubAccount.businessId !== businessId) {
      return errorResponse('Forbidden', 'UNAUTHORIZED', 403)
    }

    const tagNames = Array.isArray(body.tags)
      ? body.tags.filter(
          (t: unknown): t is string =>
            typeof t === 'string' && t.trim().length > 0
        )
      : []

    const tags: Tag[] = tagNames.length
      ? await db.tag.findMany({
          where: {
            subAccountId: lane.Pipeline.SubAccount.id,
            name: { in: tagNames },
          },
        })
      : []

    const ticket = await upsertTicketUnchecked(
      {
        laneId,
        name,
        description:
          typeof body.description === 'string' ? body.description : undefined,
        value:
          typeof body.value === 'number' || typeof body.value === 'string'
            ? body.value
            : undefined,
        customerId:
          typeof body.customerId === 'string' ? body.customerId : undefined,
        assignedUserId:
          typeof body.assignedUserId === 'string'
            ? body.assignedUserId
            : undefined,
      },
      tags
    )

    return NextResponse.json({ ticket }, { status: 201 })
  } catch (err) {
    if (err instanceof Error && err.message === 'UNAUTHORIZED') {
      return errorResponse('Unauthorized', 'UNAUTHORIZED', 401)
    }

    return errorResponse('Internal server error', 'INTERNAL_ERROR', 500)
  }
}
