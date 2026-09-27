import { NextResponse } from 'next/server'

import {
  validateInternalAuth,
  validateSubAccountForBusiness,
} from '@/lib/internal-auth'
import { getPipelinesUnchecked } from '@/lib/queries-internal'

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

    const pipelines = await getPipelinesUnchecked(subAccountId)

    return NextResponse.json({ pipelines })
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
