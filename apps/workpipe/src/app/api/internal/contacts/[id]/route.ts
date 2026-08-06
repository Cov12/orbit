import { NextResponse } from 'next/server'

import { db } from '@/lib/db'
import { validateInternalAuth } from '@/lib/internal-auth'

const errorResponse = (error: string, code: string, status: number) =>
  NextResponse.json({ error, code }, { status })

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { businessId } = await validateInternalAuth(request)
    const { id } = await params

    const contact = await db.contact.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        email: true,
        subAccountId: true,
        createdAt: true,
        updatedAt: true,
      },
    })

    if (!contact) {
      return errorResponse('Contact not found', 'NOT_FOUND', 404)
    }

    // Tenant check: the contact's sub-account must belong to the caller's
    // business, so a service token can only read its own org's contacts.
    const subAccount = await db.subAccount.findUnique({
      where: { id: contact.subAccountId },
      select: { businessId: true },
    })

    if (!subAccount) {
      return errorResponse('SubAccount not found', 'NOT_FOUND', 404)
    }

    if (subAccount.businessId !== businessId) {
      return errorResponse('Forbidden', 'UNAUTHORIZED', 403)
    }

    return NextResponse.json({ contact })
  } catch (err) {
    if (err instanceof Error && err.message === 'UNAUTHORIZED') {
      return errorResponse('Unauthorized', 'UNAUTHORIZED', 401)
    }

    return errorResponse('Internal server error', 'INTERNAL_ERROR', 500)
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { businessId } = await validateInternalAuth(request)
    const { id } = await params
    const body = await request.json()

    const contact = await db.contact.findUnique({
      where: { id },
      select: { id: true, subAccountId: true },
    })

    if (!contact) {
      return errorResponse('Contact not found', 'NOT_FOUND', 404)
    }

    const subAccount = await db.subAccount.findUnique({
      where: { id: contact.subAccountId },
      select: { businessId: true },
    })

    if (!subAccount) {
      return errorResponse('SubAccount not found', 'NOT_FOUND', 404)
    }

    if (subAccount.businessId !== businessId) {
      return errorResponse('Forbidden', 'UNAUTHORIZED', 403)
    }

    const updateData: { name?: string; email?: string } = {}

    if (typeof body.name === 'string' && body.name.trim()) {
      updateData.name = body.name.trim()
    }

    if (typeof body.email === 'string' && body.email.trim()) {
      updateData.email = body.email.trim()
    }

    if (!Object.keys(updateData).length) {
      return errorResponse('No valid fields to update', 'VALIDATION_ERROR', 422)
    }

    const updated = await db.contact.update({
      where: { id },
      data: updateData,
    })

    return NextResponse.json({ contact: updated })
  } catch (err) {
    if (err instanceof Error && err.message === 'UNAUTHORIZED') {
      return errorResponse('Unauthorized', 'UNAUTHORIZED', 401)
    }

    return errorResponse('Internal server error', 'INTERNAL_ERROR', 500)
  }
}
