import { NextResponse } from 'next/server'

import { db } from '@/lib/db'
import { validateInternalAuth } from '@/lib/internal-auth'
import { getTicketsWithTagsUnchecked } from '@/lib/queries'

const errorResponse = (error: string, code: string, status: number) =>
  NextResponse.json({ error, code }, { status })

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { businessId } = await validateInternalAuth(request)
    const { id } = await params

    const pipeline = await db.pipeline.findUnique({
      where: { id },
      include: {
        SubAccount: {
          select: { businessId: true },
        },
      },
    })

    if (!pipeline) {
      return errorResponse('Pipeline not found', 'NOT_FOUND', 404)
    }

    if (pipeline.SubAccount.businessId !== businessId) {
      return errorResponse('Forbidden', 'UNAUTHORIZED', 403)
    }

    const tickets = await getTicketsWithTagsUnchecked(id)

    return NextResponse.json({ tickets })
  } catch (err) {
    if (err instanceof Error && err.message === 'UNAUTHORIZED') {
      return errorResponse('Unauthorized', 'UNAUTHORIZED', 401)
    }

    return errorResponse('Internal server error', 'INTERNAL_ERROR', 500)
  }
}
