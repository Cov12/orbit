import { beforeEach, describe, expect, it, vi } from 'vitest'

// The guards derive the caller's business from the session and check the DB.
vi.mock('./auth', () => ({ getAuthContext: vi.fn() }))
vi.mock('./db', () => ({
  db: {
    subAccount: { findUnique: vi.fn() },
    funnel: { findUnique: vi.fn() },
  },
}))

import { getAuthContext } from './auth'
import {
  ForbiddenError,
  assertOwnsBusiness,
  assertOwnsFunnel,
  assertOwnsSubAccount,
} from './authz'
import { db } from './db'

const asMock = (fn: unknown) => fn as ReturnType<typeof vi.fn>
const asCaller = (orgId: string | null) =>
  asMock(getAuthContext).mockResolvedValue({
    orgId,
    userId: 'user-1',
    role: 'BUSINESS_OWNER',
  })

beforeEach(() => vi.clearAllMocks())

describe('assertOwnsBusiness', () => {
  it('passes when the business is the caller org', async () => {
    asCaller('biz-A')
    await expect(assertOwnsBusiness('biz-A')).resolves.toBeUndefined()
  })

  it('throws ForbiddenError for another org', async () => {
    asCaller('biz-A')
    await expect(assertOwnsBusiness('biz-B')).rejects.toBeInstanceOf(
      ForbiddenError
    )
  })

  it('throws when unauthenticated (no orgId)', async () => {
    asCaller(null)
    await expect(assertOwnsBusiness('biz-A')).rejects.toBeInstanceOf(
      ForbiddenError
    )
  })
})

describe('assertOwnsSubAccount', () => {
  it('passes when the sub-account belongs to the caller org', async () => {
    asCaller('biz-A')
    asMock(db.subAccount.findUnique).mockResolvedValue({ businessId: 'biz-A' })
    await expect(assertOwnsSubAccount('sa-1')).resolves.toBeUndefined()
  })

  it('throws for a sub-account owned by another business', async () => {
    asCaller('biz-A')
    asMock(db.subAccount.findUnique).mockResolvedValue({ businessId: 'biz-B' })
    await expect(assertOwnsSubAccount('sa-1')).rejects.toBeInstanceOf(
      ForbiddenError
    )
  })

  it('throws when the sub-account does not exist', async () => {
    asCaller('biz-A')
    asMock(db.subAccount.findUnique).mockResolvedValue(null)
    await expect(assertOwnsSubAccount('sa-x')).rejects.toBeInstanceOf(
      ForbiddenError
    )
  })
})

describe('assertOwnsFunnel', () => {
  it('passes when funnel -> sub-account -> caller org', async () => {
    asCaller('biz-A')
    asMock(db.funnel.findUnique).mockResolvedValue({ subAccountId: 'sa-1' })
    asMock(db.subAccount.findUnique).mockResolvedValue({ businessId: 'biz-A' })
    await expect(assertOwnsFunnel('f-1')).resolves.toBeUndefined()
  })

  it('throws for a funnel owned by another business', async () => {
    asCaller('biz-A')
    asMock(db.funnel.findUnique).mockResolvedValue({ subAccountId: 'sa-1' })
    asMock(db.subAccount.findUnique).mockResolvedValue({ businessId: 'biz-B' })
    await expect(assertOwnsFunnel('f-1')).rejects.toBeInstanceOf(ForbiddenError)
  })

  it('throws when the funnel does not exist', async () => {
    asCaller('biz-A')
    asMock(db.funnel.findUnique).mockResolvedValue(null)
    await expect(assertOwnsFunnel('f-x')).rejects.toBeInstanceOf(ForbiddenError)
  })
})
