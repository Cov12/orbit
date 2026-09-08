import { beforeEach, describe, expect, it, vi } from 'vitest'

// Same mocking pattern as contacts-dedupe.test.ts: the db module is a bag of
// vi.fn()s each test drives directly. There is no session here — the public
// ingest path is anonymous by design.
vi.mock('./db', () => ({
  db: {
    leadForm: { findUnique: vi.fn() },
    contact: { findFirst: vi.fn(), update: vi.fn(), create: vi.fn() },
    contactSubmission: {
      count: vi.fn(),
      updateMany: vi.fn(),
      create: vi.fn(),
    },
    tag: { findFirst: vi.fn(), create: vi.fn() },
  },
}))

import { db } from './db'
import {
  HONEYPOT_FIELD,
  RATE_LIMIT_MAX_SUBMISSIONS,
  clientIpFromHeaders,
  ingestLeadSubmission,
} from './lead-ingest'

type Mock = ReturnType<typeof vi.fn>
const leadForm = db.leadForm as unknown as { findUnique: Mock }
const contact = db.contact as unknown as {
  findFirst: Mock
  update: Mock
  create: Mock
}
const submission = db.contactSubmission as unknown as {
  count: Mock
  updateMany: Mock
  create: Mock
}
const tag = db.tag as unknown as { findFirst: Mock; create: Mock }

const FORM = {
  id: 'form-1',
  key: 'pk_live_abc',
  name: 'Contact Us',
  subAccountId: 'sa-1',
  funnelId: null,
  isActive: true,
  redirectUrl: null,
  defaultTags: [] as string[],
}

const ingest = (rawBody: object, formKey = FORM.key) =>
  ingestLeadSubmission({
    formKey,
    rawBody: JSON.stringify(rawBody),
    ipAddress: '203.0.113.7',
    userAgent: 'jest/1.0',
  })

beforeEach(() => {
  vi.clearAllMocks()
  leadForm.findUnique.mockResolvedValue({ ...FORM })
  contact.findFirst.mockResolvedValue(null)
  contact.create.mockImplementation(({ data }: { data: object }) =>
    Promise.resolve({ id: 'contact-new', ...data })
  )
  contact.update.mockImplementation(({ data }: { data: object }) =>
    Promise.resolve({ id: 'contact-existing', ...data })
  )
  submission.count.mockResolvedValue(0)
  submission.updateMany.mockResolvedValue({ count: 0 })
  submission.create.mockImplementation(({ data }: { data: object }) =>
    Promise.resolve({ id: 'sub-1', ...data })
  )
  tag.findFirst.mockResolvedValue(null)
  tag.create.mockImplementation(({ data }: { data: object }) =>
    Promise.resolve({ id: 'tag-1', ...data })
  )
})

describe('form resolution', () => {
  it('takes the sub-account from the LeadForm row the key resolves to', async () => {
    const result = await ingest({ email: 'lead@example.com' })

    expect(leadForm.findUnique).toHaveBeenCalledWith({
      where: { key: FORM.key },
    })
    expect(result.ok).toBe(true)
    expect(contact.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        subAccountId: 'sa-1',
        sourceFormId: 'form-1',
        sourceFormName: 'Contact Us',
      }),
    })
    expect(submission.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ subAccountId: 'sa-1', formId: 'form-1' }),
    })
  })

  it('404s for an unknown formKey and writes nothing', async () => {
    leadForm.findUnique.mockResolvedValue(null)

    const result = await ingest({ email: 'lead@example.com' }, 'nope')

    expect(result).toMatchObject({
      ok: false,
      status: 404,
      code: 'NOT_FOUND',
    })
    expect(contact.create).not.toHaveBeenCalled()
    expect(submission.create).not.toHaveBeenCalled()
  })

  it('rejects an inactive form with 403', async () => {
    leadForm.findUnique.mockResolvedValue({ ...FORM, isActive: false })

    const result = await ingest({ email: 'lead@example.com' })

    expect(result).toMatchObject({ ok: false, status: 403, code: 'FORBIDDEN' })
    expect(contact.create).not.toHaveBeenCalled()
    expect(submission.create).not.toHaveBeenCalled()
  })

  it('ignores a subAccountId supplied in the body', async () => {
    await ingest({ email: 'lead@example.com', subAccountId: 'sa-attacker' })

    expect(contact.findFirst).toHaveBeenCalledWith({
      where: {
        subAccountId: 'sa-1',
        email: { equals: 'lead@example.com', mode: 'insensitive' },
      },
      select: { id: true },
    })
    expect(contact.create.mock.calls[0][0].data.subAccountId).toBe('sa-1')
    expect(submission.create.mock.calls[0][0].data.subAccountId).toBe('sa-1')
    // …and it is stripped from the stored payload too.
    expect(
      submission.create.mock.calls[0][0].data.rawPayload
    ).not.toHaveProperty('subAccountId')
  })
})

describe('contact dedupe', () => {
  it('updates the existing contact when the email already exists', async () => {
    contact.findFirst.mockResolvedValue({ id: 'contact-existing' })

    const result = await ingest({ email: '  LeAd@Example.COM  ', name: 'Lead' })

    expect(contact.create).not.toHaveBeenCalled()
    expect(contact.update).toHaveBeenCalledWith({
      where: { id: 'contact-existing' },
      data: expect.objectContaining({
        email: 'lead@example.com',
        name: 'Lead',
      }),
    })
    // firstSeenAt belongs to the first touch and must not be re-stamped.
    expect(contact.update.mock.calls[0][0].data).not.toHaveProperty(
      'firstSeenAt'
    )
    expect(result).toMatchObject({
      ok: true,
      body: { contactId: 'contact-existing' },
    })
  })

  it('creates when no contact matches the email', async () => {
    const result = await ingest({ email: 'brand-new@example.com' })

    expect(contact.update).not.toHaveBeenCalled()
    expect(contact.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        email: 'brand-new@example.com',
        firstSeenAt: expect.any(Date),
      }),
    })
    expect(result).toMatchObject({
      ok: true,
      body: { contactId: 'contact-new' },
    })
  })
})

describe('richer capture fields (issue #54 phase 4b)', () => {
  it('persists phone, companyName and the message customField onto the contact', async () => {
    const result = await ingest({
      name: 'Lead',
      email: 'lead@example.com',
      phone: '555-0100',
      companyName: 'Acme Inc',
      customFields: { message: 'Please call me back' },
    })

    expect(result.ok).toBe(true)
    expect(contact.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        phone: '555-0100',
        companyName: 'Acme Inc',
        customFields: { message: 'Please call me back' },
      }),
    })
  })

  it('merges them onto an existing contact too', async () => {
    contact.findFirst.mockResolvedValue({ id: 'contact-existing' })

    await ingest({
      email: 'lead@example.com',
      phone: '555-0100',
      companyName: 'Acme Inc',
      customFields: { message: 'Please call me back' },
    })

    expect(contact.update).toHaveBeenCalledWith({
      where: { id: 'contact-existing' },
      data: expect.objectContaining({
        phone: '555-0100',
        companyName: 'Acme Inc',
        customFields: { message: 'Please call me back' },
      }),
    })
  })
})

describe('submission touch flags', () => {
  it('marks isFirstTouch for a brand new contact and clears prior last touch', async () => {
    await ingest({ email: 'brand-new@example.com' })

    expect(submission.updateMany).toHaveBeenCalledWith({
      where: { contactId: 'contact-new' },
      data: { isLastTouch: false },
    })
    expect(submission.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        contactId: 'contact-new',
        submissionType: 'form',
        isFirstTouch: true,
        isLastTouch: true,
      }),
    })
  })

  it('marks isFirstTouch false for a returning contact', async () => {
    contact.findFirst.mockResolvedValue({ id: 'contact-existing' })

    await ingest({ email: 'lead@example.com' })

    expect(submission.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        contactId: 'contact-existing',
        isFirstTouch: false,
        isLastTouch: true,
      }),
    })
  })
})

describe('bot and abuse filtering', () => {
  it('silently drops a submission with the honeypot filled', async () => {
    const result = await ingest({
      email: 'bot@example.com',
      [HONEYPOT_FIELD]: 'http://spam.example',
    })

    expect(result).toEqual({
      ok: true,
      status: 200,
      body: { success: true },
    })
    expect(contact.findFirst).not.toHaveBeenCalled()
    expect(contact.create).not.toHaveBeenCalled()
    expect(contact.update).not.toHaveBeenCalled()
    expect(submission.create).not.toHaveBeenCalled()
  })

  it('returns 429 once the per-IP threshold is reached', async () => {
    submission.count.mockResolvedValue(RATE_LIMIT_MAX_SUBMISSIONS)

    const result = await ingest({ email: 'lead@example.com' })

    expect(result).toMatchObject({
      ok: false,
      status: 429,
      code: 'RATE_LIMITED',
    })
    expect(submission.count).toHaveBeenCalledWith({
      where: {
        subAccountId: 'sa-1',
        ipAddress: '203.0.113.7',
        createdAt: { gte: expect.any(Date) },
      },
    })
    expect(contact.create).not.toHaveBeenCalled()
    expect(submission.create).not.toHaveBeenCalled()
  })

  it('lets a submission through just under the threshold', async () => {
    submission.count.mockResolvedValue(RATE_LIMIT_MAX_SUBMISSIONS - 1)

    const result = await ingest({ email: 'lead@example.com' })

    expect(result.ok).toBe(true)
    expect(submission.create).toHaveBeenCalled()
  })

  it('rejects an oversized body before touching the database', async () => {
    const result = await ingestLeadSubmission({
      formKey: FORM.key,
      rawBody: JSON.stringify({ name: 'x'.repeat(40 * 1024) }),
      ipAddress: null,
      userAgent: null,
    })

    expect(result).toMatchObject({ ok: false, status: 413 })
    expect(leadForm.findUnique).not.toHaveBeenCalled()
  })

  it('requires at least an email or a name', async () => {
    const result = await ingest({ phone: '555-0100' })

    expect(result).toMatchObject({
      ok: false,
      status: 422,
      code: 'VALIDATION_ERROR',
    })
    expect(contact.create).not.toHaveBeenCalled()
  })
})

describe('default tags and response', () => {
  it('creates and connects each default tag once', async () => {
    leadForm.findUnique.mockResolvedValue({
      ...FORM,
      defaultTags: ['Website Lead'],
      redirectUrl: 'https://example.com/thanks',
    })

    const result = await ingest({ email: 'lead@example.com' })

    expect(tag.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        name: 'Website Lead',
        subAccountId: 'sa-1',
      }),
    })
    expect(contact.update).toHaveBeenCalledWith({
      where: { id: 'contact-new' },
      data: { Tags: { connect: { id: 'tag-1' } } },
    })
    expect(result).toMatchObject({
      ok: true,
      body: {
        success: true,
        contactId: 'contact-new',
        submissionId: 'sub-1',
        redirectUrl: 'https://example.com/thanks',
      },
    })
  })

  it('reuses an existing tag of the same name', async () => {
    leadForm.findUnique.mockResolvedValue({
      ...FORM,
      defaultTags: ['Website Lead'],
    })
    tag.findFirst.mockResolvedValue({ id: 'tag-existing' })

    await ingest({ email: 'lead@example.com' })

    expect(tag.create).not.toHaveBeenCalled()
    expect(contact.update).toHaveBeenCalledWith({
      where: { id: 'contact-new' },
      data: { Tags: { connect: { id: 'tag-existing' } } },
    })
  })
})

describe('clientIpFromHeaders', () => {
  it('takes the trusted-proxy hop (rightmost), not the spoofable leftmost', () => {
    // A client can forge the left of x-forwarded-for; Render appends the real
    // IP last. With one trusted hop the rightmost entry is the client IP and a
    // prepended fake ('203.0.113.7') must be ignored.
    const headers = new Headers({
      'x-forwarded-for': ' 203.0.113.7 , 70.41.3.18 ',
      'x-real-ip': '10.0.0.1',
    })
    expect(clientIpFromHeaders(headers)).toBe('70.41.3.18')
  })

  it('falls back to x-real-ip, then null', () => {
    expect(clientIpFromHeaders(new Headers({ 'x-real-ip': '10.0.0.1' }))).toBe(
      '10.0.0.1'
    )
    expect(clientIpFromHeaders(new Headers())).toBeNull()
  })
})
