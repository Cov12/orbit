import { NextResponse } from 'next/server'

import { db } from '@/lib/db'
import { validateInternalAuth } from '@/lib/internal-auth'

const errorResponse = (error: string, code: string, status: number) =>
  NextResponse.json({ error, code }, { status })

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { businessId } = await validateInternalAuth(request)
    const { id } = await params
    const body = await request.json()

    const existing = await db.ticket.findUnique({
      where: { id },
      include: {
        Lane: {
          include: {
            Pipeline: {
              include: {
                SubAccount: { select: { businessId: true } },
              },
            },
          },
        },
      },
    })

    if (!existing) {
      return errorResponse('Ticket not found', 'NOT_FOUND', 404)
    }

    if (existing.Lane.Pipeline.SubAccount.businessId !== businessId) {
      return errorResponse('Forbidden', 'UNAUTHORIZED', 403)
    }

    const data: {
      name?: string
      description?: string | null
      value?: number | string | null
      customerId?: string | null
      assignedUserId?: string | null
      laneId?: string
    } = {}

    if (typeof body.name === 'string') data.name = body.name.trim()
    if (typeof body.description === 'string' || body.description === null) {
      data.description = body.description
    }
    if (
      typeof body.value === 'number' ||
      typeof body.value === 'string' ||
      body.value === null
    ) {
      data.value = body.value
    }
    if (typeof body.customerId === 'string' || body.customerId === null) {
      data.customerId = body.customerId
    }
    if (
      typeof body.assignedUserId === 'string' ||
      body.assignedUserId === null
    ) {
      data.assignedUserId = body.assignedUserId
    }

    if (typeof body.laneId === 'string' && body.laneId !== existing.laneId) {
      const targetLane = await db.lane.findUnique({
        where: { id: body.laneId },
        include: {
          Pipeline: {
            include: {
              SubAccount: { select: { businessId: true } },
            },
          },
        },
      })

      if (!targetLane) {
        return errorResponse('Target lane not found', 'NOT_FOUND', 404)
      }

      if (targetLane.Pipeline.SubAccount.businessId !== businessId) {
        return errorResponse('Forbidden', 'UNAUTHORIZED', 403)
      }

      data.laneId = body.laneId
    }

    if (!Object.keys(data).length) {
      return errorResponse('No valid fields to update', 'VALIDATION_ERROR', 422)
    }

    const ticket = await db.ticket.update({
      where: { id },
      data,
      include: {
        Assigned: true,
        Customer: true,
        Tags: true,
        Lane: true,
      },
    })

    return NextResponse.json({
      ticket: {
        ...ticket,
        value: ticket.value?.toNumber() ?? null,
      },
    })
  } catch (err) {
    if (err instanceof Error && err.message === 'UNAUTHORIZED') {
      return errorResponse('Unauthorized', 'UNAUTHORIZED', 401)
    }

    return errorResponse('Internal server error', 'INTERNAL_ERROR', 500)
  }
}
