import { beforeEach, describe, expect, it, vi } from 'vitest'

// The guards derive the caller's business from the session and check the DB.
vi.mock('./auth', () => ({ getAuthContext: vi.fn() }))
vi.mock('./db', () => ({
  db: {
    subAccount: { findUnique: vi.fn() },
    funnel: { findUnique: vi.fn() },
    user: { findUnique: vi.fn() },
    permissions: { findUnique: vi.fn() },
  },
}))

import { getAuthContext } from './auth'
import {
  ForbiddenError,
  assertCanManagePermissions,
  assertCanUpdateUser,
  assertCanUpsertSubAccount,
  assertManagesUser,
  assertOwnsBusiness,
  assertOwnsFunnel,
  assertOwnsSubAccount,
} from './authz'
import { db } from './db'

const asMock = (fn: unknown) => fn as ReturnType<typeof vi.fn>
const asCaller = (
  orgId: string | null,
  role: string | null = 'OWNER',
  userId = 'user-1'
) => asMock(getAuthContext).mockResolvedValue({ orgId, userId, role })

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

describe('assertManagesUser', () => {
  it('passes for an admin managing a user in their own business', async () => {
    asCaller('biz-A', 'ADMIN')
    asMock(db.user.findUnique).mockResolvedValue({ businessId: 'biz-A' })
    await expect(assertManagesUser('u2')).resolves.toBeUndefined()
  })

  it('throws for a non-admin caller', async () => {
    asCaller('biz-A', 'MEMBER')
    await expect(assertManagesUser('u2')).rejects.toBeInstanceOf(ForbiddenError)
  })

  it('throws for a user in another business', async () => {
    asCaller('biz-A', 'ADMIN')
    asMock(db.user.findUnique).mockResolvedValue({ businessId: 'biz-B' })
    await expect(assertManagesUser('u2')).rejects.toBeInstanceOf(ForbiddenError)
  })

  it('throws when the user does not exist', async () => {
    asCaller('biz-A', 'ADMIN')
    asMock(db.user.findUnique).mockResolvedValue(null)
    await expect(assertManagesUser('u-x')).rejects.toBeInstanceOf(
      ForbiddenError
    )
  })
})

describe('assertCanUpdateUser', () => {
  const target = (over: Record<string, unknown> = {}) => ({
    id: 'u1',
    businessId: 'biz-A',
    role: 'SUBACCOUNT_USER',
    ...over,
  })

  it('allows a member to edit their own non-role fields', async () => {
    asCaller('biz-A', 'MEMBER', 'u1')
    asMock(db.user.findUnique).mockResolvedValue(target())
    await expect(
      assertCanUpdateUser('me@x.com', undefined)
    ).resolves.toBeUndefined()
  })

  it('allows a self-edit that resubmits the unchanged role', async () => {
    asCaller('biz-A', 'MEMBER', 'u1')
    asMock(db.user.findUnique).mockResolvedValue(target())
    await expect(
      assertCanUpdateUser('me@x.com', 'SUBACCOUNT_USER')
    ).resolves.toBeUndefined()
  })

  it('throws when a non-admin edits another user', async () => {
    asCaller('biz-A', 'MEMBER', 'u1')
    asMock(db.user.findUnique).mockResolvedValue(target({ id: 'u2' }))
    await expect(
      assertCanUpdateUser('other@x.com', undefined)
    ).rejects.toBeInstanceOf(ForbiddenError)
  })

  it('throws when a non-admin changes their own role', async () => {
    asCaller('biz-A', 'MEMBER', 'u1')
    asMock(db.user.findUnique).mockResolvedValue(target())
    await expect(
      assertCanUpdateUser('me@x.com', 'BUSINESS_ADMIN')
    ).rejects.toBeInstanceOf(ForbiddenError)
  })

  it('lets an admin change another user role', async () => {
    asCaller('biz-A', 'ADMIN', 'admin-1')
    asMock(db.user.findUnique).mockResolvedValue(target({ id: 'u2' }))
    await expect(
      assertCanUpdateUser('u2@x.com', 'BUSINESS_ADMIN')
    ).resolves.toBeUndefined()
  })

  it('forbids an admin from promoting to owner', async () => {
    asCaller('biz-A', 'ADMIN', 'admin-1')
    asMock(db.user.findUnique).mockResolvedValue(target({ id: 'u2' }))
    await expect(
      assertCanUpdateUser('u2@x.com', 'BUSINESS_OWNER')
    ).rejects.toBeInstanceOf(ForbiddenError)
  })

  it('lets an owner promote to owner', async () => {
    asCaller('biz-A', 'OWNER', 'owner-1')
    asMock(db.user.findUnique).mockResolvedValue(target({ id: 'u2' }))
    await expect(
      assertCanUpdateUser('u2@x.com', 'BUSINESS_OWNER')
    ).resolves.toBeUndefined()
  })

  it('throws for a target in another business', async () => {
    asCaller('biz-A', 'ADMIN', 'admin-1')
    asMock(db.user.findUnique).mockResolvedValue(
      target({ id: 'u2', businessId: 'biz-B' })
    )
    await expect(
      assertCanUpdateUser('u2@x.com', undefined)
    ).rejects.toBeInstanceOf(ForbiddenError)
  })
})

describe('assertCanManagePermissions', () => {
  it('passes for an admin granting on an owned sub-account', async () => {
    asCaller('biz-A', 'ADMIN')
    asMock(db.subAccount.findUnique).mockResolvedValue({ businessId: 'biz-A' })
    await expect(assertCanManagePermissions('sa-1')).resolves.toBeUndefined()
  })

  it('throws for a non-admin caller', async () => {
    asCaller('biz-A', 'MEMBER')
    await expect(assertCanManagePermissions('sa-1')).rejects.toBeInstanceOf(
      ForbiddenError
    )
  })

  it('throws for a foreign sub-account', async () => {
    asCaller('biz-A', 'ADMIN')
    asMock(db.subAccount.findUnique).mockResolvedValue({ businessId: 'biz-B' })
    await expect(
      assertCanManagePermissions('sa-foreign')
    ).rejects.toBeInstanceOf(ForbiddenError)
  })

  it('throws when updating a permission row on a foreign sub-account', async () => {
    asCaller('biz-A', 'ADMIN')
    asMock(db.subAccount.findUnique).mockImplementation((args: unknown) =>
      Promise.resolve({
        businessId:
          (args as { where: { id: string } }).where.id === 'sa-owned'
            ? 'biz-A'
            : 'biz-B',
      })
    )
    asMock(db.permissions.findUnique).mockResolvedValue({
      subAccountId: 'sa-foreign',
    })
    await expect(
      assertCanManagePermissions('sa-owned', 'perm-1')
    ).rejects.toBeInstanceOf(ForbiddenError)
  })
})

describe('assertCanUpsertSubAccount', () => {
  it('passes when the caller owns the business and the id is new', async () => {
    asCaller('biz-A')
    asMock(db.subAccount.findUnique).mockResolvedValue(null)
    await expect(
      assertCanUpsertSubAccount('sa-new', 'biz-A')
    ).resolves.toBeUndefined()
  })

  it('throws when the business is not the caller org', async () => {
    asCaller('biz-A')
    await expect(
      assertCanUpsertSubAccount('sa-1', 'biz-B')
    ).rejects.toBeInstanceOf(ForbiddenError)
  })

  it('throws when the existing sub-account belongs to another business', async () => {
    asCaller('biz-A')
    asMock(db.subAccount.findUnique).mockResolvedValue({ businessId: 'biz-B' })
    await expect(
      assertCanUpsertSubAccount('sa-1', 'biz-A')
    ).rejects.toBeInstanceOf(ForbiddenError)
  })
})
