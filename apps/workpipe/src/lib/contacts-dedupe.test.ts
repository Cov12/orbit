import { beforeEach, describe, expect, it, vi } from 'vitest'

// Same mocking pattern as queries.authz.test.ts: the session owns "biz-A", and
// the db module is a bag of vi.fn()s each test drives directly.
vi.mock('./auth', () => ({
  getAuthContext: vi.fn().mockResolvedValue({
    orgId: 'biz-A',
    userId: 'user-1',
    role: 'ADMIN',
  }),
  getAuthAdmin: vi.fn(),
  getCurrentUser: vi.fn(),
}))
vi.mock('./db', () => ({
  db: {
    subAccount: { findUnique: vi.fn() },
    contact: {
      findFirst: vi.fn(),
      update: vi.fn(),
      create: vi.fn(),
      upsert: vi.fn(),
    },
  },
}))
vi.mock('./mailer', () => ({ sendMail: vi.fn() }))
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))
vi.mock('next/headers', () => ({ cookies: vi.fn() }))
vi.mock('next/navigation', () => ({ redirect: vi.fn() }))

import { ForbiddenError } from './authz'
import { db } from './db'
import { upsertContact } from './queries'

const subAccount = db.subAccount as unknown as {
  findUnique: ReturnType<typeof vi.fn>
}
const contact = db.contact as unknown as {
  findFirst: ReturnType<typeof vi.fn>
  update: ReturnType<typeof vi.fn>
  create: ReturnType<typeof vi.fn>
  upsert: ReturnType<typeof vi.fn>
}

// "sa-1" belongs to the caller's business; anything else does not.
const ownedByCaller = (id: string) =>
  id === 'sa-1' ? { businessId: 'biz-A' } : { businessId: 'biz-B' }

beforeEach(() => {
  vi.clearAllMocks()
  subAccount.findUnique.mockImplementation(
    ({ where }: { where: { id: string } }) =>
      Promise.resolve(ownedByCaller(where.id))
  )
  contact.findFirst.mockResolvedValue(null)
  contact.update.mockImplementation(({ data }: { data: object }) =>
    Promise.resolve({ id: 'contact-existing', ...data })
  )
  contact.create.mockImplementation(({ data }: { data: object }) =>
    Promise.resolve({ id: 'contact-new', ...data })
  )
})

describe('upsertContact dedupe (issue #54)', () => {
  it('updates the existing contact when the email already exists in the sub-account', async () => {
    contact.findFirst.mockResolvedValue({ id: 'contact-existing' })

    const result = await upsertContact({
      email: 'lead@example.com',
      name: 'Lead Renamed',
      subAccountId: 'sa-1',
    })

    expect(contact.create).not.toHaveBeenCalled()
    expect(contact.update).toHaveBeenCalledWith({
      where: { id: 'contact-existing' },
      data: {
        email: 'lead@example.com',
        name: 'Lead Renamed',
        subAccountId: 'sa-1',
      },
    })
    expect(result).toMatchObject({
      id: 'contact-existing',
      name: 'Lead Renamed',
    })
  })

  it('creates when no contact matches the email', async () => {
    contact.findFirst.mockResolvedValue(null)

    const result = await upsertContact({
      email: 'brand-new@example.com',
      name: 'Brand New',
      subAccountId: 'sa-1',
    })

    expect(contact.update).not.toHaveBeenCalled()
    expect(contact.create).toHaveBeenCalledWith({
      data: {
        email: 'brand-new@example.com',
        name: 'Brand New',
        subAccountId: 'sa-1',
      },
    })
    expect(result).toMatchObject({ id: 'contact-new' })
  })

  it('scopes the match to the sub-account', async () => {
    await upsertContact({
      email: 'lead@example.com',
      name: 'Lead',
      subAccountId: 'sa-1',
    })

    expect(contact.findFirst).toHaveBeenCalledWith({
      where: {
        subAccountId: 'sa-1',
        email: { equals: 'lead@example.com', mode: 'insensitive' },
      },
      select: { id: true },
    })
  })

  it('matches case-insensitively and stores the normalized email', async () => {
    contact.findFirst.mockResolvedValue({ id: 'contact-existing' })

    await upsertContact({
      email: '  LeAd@Example.COM  ',
      name: 'Lead',
      subAccountId: 'sa-1',
    })

    expect(contact.findFirst).toHaveBeenCalledWith({
      where: {
        subAccountId: 'sa-1',
        email: { equals: 'lead@example.com', mode: 'insensitive' },
      },
      select: { id: true },
    })
    expect(contact.update).toHaveBeenCalledWith({
      where: { id: 'contact-existing' },
      data: {
        email: 'lead@example.com',
        name: 'Lead',
        subAccountId: 'sa-1',
      },
    })
  })

  it('keeps upsert-by-id behaviour when an id is supplied', async () => {
    contact.upsert.mockResolvedValue({ id: 'contact-1' })

    await upsertContact({
      id: 'contact-1',
      email: 'Lead@Example.com',
      name: 'Lead',
      subAccountId: 'sa-1',
    })

    expect(contact.findFirst).not.toHaveBeenCalled()
    expect(contact.upsert).toHaveBeenCalledWith({
      where: { id: 'contact-1' },
      update: {
        id: 'contact-1',
        email: 'lead@example.com',
        name: 'Lead',
        subAccountId: 'sa-1',
      },
      create: {
        id: 'contact-1',
        email: 'lead@example.com',
        name: 'Lead',
        subAccountId: 'sa-1',
      },
    })
  })
})

describe('upsertContact ownership guard', () => {
  it('rejects a foreign subAccountId with ForbiddenError', async () => {
    await expect(
      upsertContact({
        email: 'lead@example.com',
        name: 'Lead',
        subAccountId: 'sa-foreign',
      })
    ).rejects.toBeInstanceOf(ForbiddenError)

    expect(contact.findFirst).not.toHaveBeenCalled()
    expect(contact.update).not.toHaveBeenCalled()
    expect(contact.create).not.toHaveBeenCalled()
  })
})
