import type { Business } from '@prisma/client'
import { beforeEach, describe, expect, it, vi } from 'vitest'

// Every export of a 'use server' module is callable from any browser with any
// arguments. The session says the caller is an ADMIN of "biz-A"; every resource
// the guards look up belongs to "biz-B". Each action must act only on the
// caller's own business or refuse before touching the database.
vi.mock('./auth', () => ({
  getAuthContext: vi.fn(),
  getAuthAdmin: vi.fn(),
  getCurrentUser: vi.fn(),
}))
vi.mock('./db', () => ({
  db: {
    subAccount: {
      findUnique: vi.fn().mockResolvedValue({ businessId: 'biz-B' }),
    },
    business: { upsert: vi.fn().mockResolvedValue({ id: 'biz-A' }) },
    calendarEvent: {
      findUnique: vi.fn().mockResolvedValue({ subAccountId: 'sa-foreign' }),
      findMany: vi.fn().mockResolvedValue([]),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    user: { findUnique: vi.fn().mockResolvedValue({ id: 'user-1', name: 'U' }) },
    notification: { create: vi.fn() },
  },
}))
vi.mock('./mailer', () => ({ sendMail: vi.fn() }))
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))
vi.mock('next/headers', () => ({ cookies: vi.fn() }))
vi.mock('next/navigation', () => ({ redirect: vi.fn() }))

import { getAuthContext, getCurrentUser } from './auth'
import { ForbiddenError } from './authz'
import { db } from './db'
import * as queries from './queries'
import {
  deleteCalendarEvent,
  getCalendarEventById,
  getCalendarEvents,
  upsertCalendarEvent,
} from './queries/calendar'

const asMock = (fn: unknown) => fn as ReturnType<typeof vi.fn>

const asAdminOfBizA = () =>
  asMock(getAuthContext).mockResolvedValue({
    orgId: 'biz-A',
    userId: 'user-1',
    role: 'ADMIN',
  })

beforeEach(() => {
  vi.clearAllMocks()
  asAdminOfBizA()
})

describe('upsertBusiness', () => {
  const foreign = {
    id: 'biz-B',
    name: 'Renamed',
    companyEmail: 'victim@example.com',
    companyPhone: '555-0100',
    address: '1 Main St',
    city: 'Town',
    zipCode: '00000',
    state: 'ST',
    country: 'US',
    businessLogo: '',
    whiteLabel: true,
    goal: 5,
    connectAccountId: 'acct_attacker',
    customerId: 'cus_attacker',
  } as unknown as Business

  it("writes only the caller's own business, whatever id is sent", async () => {
    await queries.upsertBusiness(foreign)
    const args = asMock(db.business.upsert).mock.calls[0][0]
    expect(args.where).toEqual({ id: 'biz-A' })
    expect(args.create.id).toBe('biz-A')
  })

  it('never writes the Stripe-linked ids from the client', async () => {
    await queries.upsertBusiness(foreign)
    const args = asMock(db.business.upsert).mock.calls[0][0]
    for (const part of [args.update, args.create]) {
      expect(part).not.toHaveProperty('connectAccountId')
      expect(part).not.toHaveProperty('customerId')
    }
  })

  it('attaches the caller on create, not the owner of companyEmail', async () => {
    await queries.upsertBusiness(foreign)
    const args = asMock(db.business.upsert).mock.calls[0][0]
    expect(args.create.users).toEqual({ connect: { id: 'user-1' } })
  })

  it('refuses a member (owner/admin only)', async () => {
    asMock(getAuthContext).mockResolvedValue({
      orgId: 'biz-A',
      userId: 'user-1',
      role: 'MEMBER',
    })
    await expect(queries.upsertBusiness(foreign)).rejects.toBeInstanceOf(
      ForbiddenError
    )
    expect(db.business.upsert).not.toHaveBeenCalled()
  })

  it('refuses an anonymous caller', async () => {
    asMock(getAuthContext).mockResolvedValue({
      orgId: null,
      userId: null,
      role: null,
    })
    await expect(queries.upsertBusiness(foreign)).rejects.toBeInstanceOf(
      ForbiddenError
    )
    expect(db.business.upsert).not.toHaveBeenCalled()
  })
})

describe('calendar actions refuse a foreign sub-account', () => {
  it('getCalendarEvents', async () => {
    await expect(getCalendarEvents('sa-foreign')).rejects.toBeInstanceOf(
      ForbiddenError
    )
    expect(db.calendarEvent.findMany).not.toHaveBeenCalled()
  })

  it('getCalendarEventById', () =>
    expect(getCalendarEventById('ev-1')).rejects.toBeInstanceOf(ForbiddenError))

  it('upsertCalendarEvent', async () => {
    await expect(
      upsertCalendarEvent({
        title: 'x',
        start: '2026-01-01T10:00',
        subAccountId: 'sa-foreign',
      } as never)
    ).rejects.toBeInstanceOf(ForbiddenError)
    expect(db.calendarEvent.create).not.toHaveBeenCalled()
    expect(db.calendarEvent.update).not.toHaveBeenCalled()
  })

  it('deleteCalendarEvent', async () => {
    await expect(deleteCalendarEvent('ev-1')).rejects.toBeInstanceOf(
      ForbiddenError
    )
    expect(db.calendarEvent.delete).not.toHaveBeenCalled()
  })
})

describe('saveActivityLogsNotification', () => {
  it('does nothing for an anonymous caller', async () => {
    asMock(getCurrentUser).mockResolvedValue(null)
    await queries.saveActivityLogsNotification({
      description: 'spoofed',
      subaccountId: 'sa-foreign',
    })
    expect(db.notification.create).not.toHaveBeenCalled()
  })

  it("does nothing for another business's sub-account", async () => {
    asMock(getCurrentUser).mockResolvedValue({ email: 'u@example.com' })
    await queries.saveActivityLogsNotification({
      description: 'spoofed',
      subaccountId: 'sa-foreign',
    })
    expect(db.notification.create).not.toHaveBeenCalled()
  })
})

describe('the server-action module', () => {
  it('exports no tenant-unchecked functions', () => {
    const unchecked = Object.keys(queries).filter(k => k.endsWith('Unchecked'))
    expect(unchecked).toEqual([])
  })
})
