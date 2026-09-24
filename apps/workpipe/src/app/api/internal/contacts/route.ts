import { NextResponse } from 'next/server'

import { db } from '@/lib/db'
import { upsertContactUnchecked } from '@/lib/queries'
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
    const search = searchParams.get('search')?.trim() || ''
    const limit = Number(searchParams.get('limit') ?? '50')
    const offset = Number(searchParams.get('offset') ?? '0')

    if (!subAccountId) {
      return errorResponse('subAccountId is required', 'VALIDATION_ERROR', 422)
    }

    if (
      !Number.isFinite(limit) ||
      !Number.isFinite(offset) ||
      limit < 1 ||
      offset < 0
    ) {
      return errorResponse(
        'Invalid pagination parameters',
        'VALIDATION_ERROR',
        422
      )
    }

    await validateSubAccountForBusiness(subAccountId, businessId)

    const where = {
      subAccountId,
      ...(search
        ? {
            OR: [
              { name: { contains: search, mode: 'insensitive' as const } },
              { email: { contains: search, mode: 'insensitive' as const } },
            ],
          }
        : {}),
    }

    const [contacts, total] = await db.$transaction([
      db.contact.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: Math.min(limit, 200),
        skip: offset,
      }),
      db.contact.count({ where }),
    ])

    return NextResponse.json({ contacts, total })
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

export async function POST(request: Request) {
  try {
    const { businessId } = await validateInternalAuth(request)
    const body = await request.json()

    const subAccountId =
      typeof body.subAccountId === 'string' ? body.subAccountId : ''
    const name = typeof body.name === 'string' ? body.name.trim() : ''
    const email = typeof body.email === 'string' ? body.email.trim() : ''

    if (!subAccountId || !name || !email) {
      return errorResponse(
        'subAccountId, name, and email are required',
        'VALIDATION_ERROR',
        422
      )
    }

    await validateSubAccountForBusiness(subAccountId, businessId)

    const contact = await upsertContactUnchecked({
      subAccountId,
      name,
      email,
    })

    return NextResponse.json({ contact }, { status: 201 })
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
