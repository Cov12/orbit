import { describe, expect, it } from 'vitest'

import { computeInvoiceTotals } from './invoice-totals'

describe('computeInvoiceTotals', () => {
  it('computes per-line totals, the subtotal, and total due (subtotal + tax − discount)', () => {
    const r = computeInvoiceTotals(
      [
        { quantity: 2, unitPriceCents: 1500 },
        { quantity: 1, unitPriceCents: 500 },
      ],
      350, // tax
      100 // discount
    )
    expect(r.lines[0].totalCents).toBe(3000)
    expect(r.lines[1].totalCents).toBe(500)
    expect(r.subTotalCents).toBe(3500)
    expect(r.totalDueCents).toBe(3750)
  })

  it('floors the total at 0 when discount exceeds subtotal + tax', () => {
    const r = computeInvoiceTotals(
      [{ quantity: 1, unitPriceCents: 1000 }],
      0,
      5000
    )
    expect(r.totalDueCents).toBe(0)
  })

  it('rounds fractional line totals to whole cents', () => {
    const r = computeInvoiceTotals(
      [{ quantity: 1.5, unitPriceCents: 101 }],
      0,
      0
    )
    expect(r.lines[0].totalCents).toBe(152) // 151.5 → 152
  })

  it('clamps negative tax and discount to 0', () => {
    const r = computeInvoiceTotals(
      [{ quantity: 1, unitPriceCents: 1000 }],
      -50,
      -50
    )
    expect(r.subTotalCents).toBe(1000)
    expect(r.totalDueCents).toBe(1000)
  })

  it('returns zeros for no line items', () => {
    const r = computeInvoiceTotals([], 0, 0)
    expect(r.lines).toEqual([])
    expect(r.subTotalCents).toBe(0)
    expect(r.totalDueCents).toBe(0)
  })

  it('recomputes each line from quantity × unit price — a client-supplied total is ignored', () => {
    // A bogus client `totalCents` rides along on the input; the server must
    // overwrite it with quantity × unit price.
    const line = { quantity: 2, unitPriceCents: 250, totalCents: 999999 }
    const r = computeInvoiceTotals([line], 0, 0)
    expect(r.lines[0].totalCents).toBe(500)
    expect(r.subTotalCents).toBe(500)
  })
})
