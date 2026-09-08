import { beforeEach, describe, expect, it, vi } from 'vitest'

// Same mocking pattern as lead-ingest.test.ts: the db module is a bag of
// vi.fn()s each test drives directly. No session here — provisioning runs on
// the anonymous public funnel render path.
vi.mock('./db', () => ({
  db: {
    leadForm: { findFirst: vi.fn(), create: vi.fn() },
  },
}))

import { db } from './db'
import { ensureFunnelLeadForm } from './lead-form'

type Mock = ReturnType<typeof vi.fn>
const leadForm = db.leadForm as unknown as { findFirst: Mock; create: Mock }

const FUNNEL = { id: 'funnel-1', subAccountId: 'sa-1', name: 'Spring Promo' }

beforeEach(() => {
  vi.clearAllMocks()
})

describe('ensureFunnelLeadForm', () => {
  it('creates a form and returns its key when the funnel has none', async () => {
    leadForm.findFirst.mockResolvedValue(null)
    leadForm.create.mockImplementation(({ data }: { data: { key: string } }) =>
      Promise.resolve({ key: data.key })
    )

    const key = await ensureFunnelLeadForm(FUNNEL)

    expect(leadForm.create).toHaveBeenCalledTimes(1)
    const { data } = leadForm.create.mock.calls[0][0]
    expect(data.subAccountId).toBe('sa-1')
    expect(data.funnelId).toBe('funnel-1')
    expect(data.name).toBe('Spring Promo — Contact Form')
    expect(data.key).toEqual(expect.any(String))
    expect(data.key.length).toBeGreaterThan(0)
    // The returned key is the one that was persisted — it is what the live
    // form embeds in /api/forms/[formKey]/submit.
    expect(key).toBe(data.key)
  })

  it('returns the existing key without creating a second form', async () => {
    leadForm.findFirst.mockResolvedValue({ key: 'existing-key' })

    const key = await ensureFunnelLeadForm(FUNNEL)

    expect(key).toBe('existing-key')
    expect(leadForm.create).not.toHaveBeenCalled()
    expect(leadForm.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { subAccountId: 'sa-1', funnelId: 'funnel-1' },
      })
    )
  })

  it('returns null instead of throwing when the database fails', async () => {
    leadForm.findFirst.mockRejectedValue(new Error('db down'))
    const consoleError = vi
      .spyOn(console, 'error')
      .mockImplementation(() => undefined)

    // A provisioning failure must never take down the live funnel page.
    await expect(ensureFunnelLeadForm(FUNNEL)).resolves.toBeNull()

    consoleError.mockRestore()
  })

  it('returns null when the create fails', async () => {
    leadForm.findFirst.mockResolvedValue(null)
    leadForm.create.mockRejectedValue(new Error('unique violation'))
    const consoleError = vi
      .spyOn(console, 'error')
      .mockImplementation(() => undefined)

    await expect(ensureFunnelLeadForm(FUNNEL)).resolves.toBeNull()

    consoleError.mockRestore()
  })
})
