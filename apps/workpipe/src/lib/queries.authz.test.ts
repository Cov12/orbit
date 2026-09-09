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
    contact: {
      findUnique: vi.fn().mockResolvedValue({ subAccountId: 'sa-1' }),
      update: vi.fn().mockResolvedValue({ id: 'c-1' }),
    },
    tag: { findUnique: vi.fn().mockResolvedValue({ subAccountId: 'sa-1' }) },
  },
}))
vi.mock('./mailer', () => ({ sendMail: vi.fn() }))
// Next server APIs are import-only here (never reached — the guard throws first).
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))
vi.mock('next/headers', () => ({ cookies: vi.fn() }))
vi.mock('next/navigation', () => ({ redirect: vi.fn() }))

import { ForbiddenError } from './authz'
import { db } from './db'
import {
  addTagToContact,
  changeUserPermissions,
  createMedia,
  deleteUser,
  getProfiles,
  getSubAccountContacts,
  getUser,
  getUserPermissions,
  markInvoiceSent,
  removeTagFromContact,
  searchContacts,
  sendInvitation,
  sendInvoiceEmail,
  updateFunnelProducts,
  updateUser,
  upsertSubAccount,
} from './queries'

const asMock = (fn: unknown) => fn as ReturnType<typeof vi.fn>

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

// Phase 5 (#54): the contact-tag actions take two client-supplied ids, so each
// must guard BOTH — a foreign contact and a foreign tag are equally rejected,
// and neither may reach the write.
describe('phase 5 contact-tag guards', () => {
  // The default sub-account mock resolves to biz-B (foreign). Queue owned
  // answers with `Once` so nothing leaks into the next test.
  const ownedOnce = (times: number) => {
    const m = asMock(db.subAccount.findUnique)
    for (let i = 0; i < times; i++)
      m.mockResolvedValueOnce({ businessId: 'biz-A' })
  }

  it('getSubAccountContacts rejects a foreign sub-account', () =>
    rejectsForbidden(getSubAccountContacts('sa-foreign', ['tag-1'])))

  it('addTagToContact rejects a foreign contact', async () => {
    await rejectsForbidden(addTagToContact('c-foreign', 'tag-1'))
    expect(db.contact.update).not.toHaveBeenCalled()
  })

  it('addTagToContact rejects a foreign tag on an owned contact', async () => {
    ownedOnce(1) // contact resolves to the caller's business; the tag does not
    await rejectsForbidden(addTagToContact('c-1', 'tag-foreign'))
    expect(db.contact.update).not.toHaveBeenCalled()
  })

  it('addTagToContact connects the tag when both are owned', async () => {
    ownedOnce(2)
    await addTagToContact('c-1', 'tag-1')
    expect(db.contact.update).toHaveBeenCalledWith({
      where: { id: 'c-1' },
      data: { Tags: { connect: { id: 'tag-1' } } },
    })
  })

  it('removeTagFromContact rejects a foreign contact', async () => {
    await rejectsForbidden(removeTagFromContact('c-foreign', 'tag-1'))
    expect(db.contact.update).not.toHaveBeenCalled()
  })

  it('removeTagFromContact rejects a foreign tag on an owned contact', async () => {
    ownedOnce(1)
    await rejectsForbidden(removeTagFromContact('c-1', 'tag-foreign'))
    expect(db.contact.update).not.toHaveBeenCalled()
  })

  it('removeTagFromContact disconnects the tag when both are owned', async () => {
    ownedOnce(2)
    await removeTagFromContact('c-1', 'tag-1')
    expect(db.contact.update).toHaveBeenCalledWith({
      where: { id: 'c-1' },
      data: { Tags: { disconnect: { id: 'tag-1' } } },
    })
  })
})
