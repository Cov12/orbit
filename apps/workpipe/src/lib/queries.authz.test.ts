import { beforeEach, describe, expect, it, vi } from 'vitest'

// Session says the caller owns "biz-A"; every resource the guards look up
// resolves to "biz-B" (a different business) — so each guarded action must
// reject a foreign id with ForbiddenError before doing any work.
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
    subAccount: {
      findUnique: vi.fn().mockResolvedValue({ businessId: 'biz-B' }),
    },
    funnel: { findUnique: vi.fn().mockResolvedValue({ subAccountId: 'sa-1' }) },
    user: {
      findUnique: vi.fn().mockResolvedValue({
        id: 'u-other',
        businessId: 'biz-B',
        role: 'SUBACCOUNT_USER',
      }),
    },
    permissions: {
      findUnique: vi.fn().mockResolvedValue({ subAccountId: 'sa-foreign' }),
    },
  },
}))
vi.mock('./mailer', () => ({ sendMail: vi.fn() }))
// Next server APIs are import-only here (never reached — the guard throws first).
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))
vi.mock('next/headers', () => ({ cookies: vi.fn() }))
vi.mock('next/navigation', () => ({ redirect: vi.fn() }))

import { ForbiddenError } from './authz'
import {
  changeUserPermissions,
  createMedia,
  deleteUser,
  getProfiles,
  getUser,
  getUserPermissions,
  markInvoiceSent,
  searchContacts,
  sendInvitation,
  sendInvoiceEmail,
  updateFunnelProducts,
  updateUser,
  upsertSubAccount,
} from './queries'

const rejectsForbidden = (p: Promise<unknown>) =>
  expect(p).rejects.toBeInstanceOf(ForbiddenError)

beforeEach(() => vi.clearAllMocks())

describe('PR-A ownership guards — foreign id is rejected', () => {
  it('getProfiles', () => rejectsForbidden(getProfiles('sa-foreign')))

  it('createMedia', () =>
    rejectsForbidden(
      createMedia('sa-foreign', { link: 'x', name: 'y' } as never)
    ))

  it('markInvoiceSent', () =>
    rejectsForbidden(markInvoiceSent('sa-foreign', 'inv-1')))

  it('sendInvoiceEmail', () =>
    rejectsForbidden(sendInvoiceEmail('sa-foreign', 'inv-1', 'a@b.com')))

  it('searchContacts', () =>
    rejectsForbidden(searchContacts('sa-foreign', 'term')))

  it('updateFunnelProducts', () =>
    rejectsForbidden(updateFunnelProducts('products', 'funnel-foreign')))

  it('sendInvitation', () =>
    rejectsForbidden(
      sendInvitation('BUSINESS_ADMIN' as never, 'a@b.com', 'biz-B')
    ))
})

describe('PR-B user-management guards — foreign/unauthorized is rejected', () => {
  it('getUser', () => rejectsForbidden(getUser('u-foreign')))

  it('getUserPermissions', () =>
    rejectsForbidden(getUserPermissions('u-foreign')))

  it('deleteUser', () => rejectsForbidden(deleteUser('u-foreign')))

  it('updateUser (foreign-business target)', () =>
    rejectsForbidden(
      updateUser({ email: 'foreign@x.com', name: 'x' } as never)
    ))

  it('changeUserPermissions', () =>
    rejectsForbidden(
      changeUserPermissions(undefined, 'u@x.com', 'sa-foreign', true)
    ))

  it('upsertSubAccount', () =>
    rejectsForbidden(
      upsertSubAccount({ id: 'sa-1', businessId: 'biz-B' } as never)
    ))
})
