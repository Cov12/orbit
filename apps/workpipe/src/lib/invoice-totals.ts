/**
 * Pure invoice money math. Kept free of `db` / `'use server'` so it can be
 * reused and unit-tested in isolation. All amounts are integer cents.
 *
 * The server ALWAYS recomputes these from the line items + tax/discount — the
 * client's claimed subtotal/total are never trusted.
 */

export interface InvoiceLineInput {
  quantity: number
  unitPriceCents: number
}

export interface InvoiceTotals<T extends InvoiceLineInput> {
  /** Line items with a server-computed `totalCents` (= quantity × unit price). */
  lines: Array<T & { totalCents: number }>
  subTotalCents: number
  totalDueCents: number
}

/**
 * Compute per-line totals, the subtotal, and the amount due.
 *
 * total = subtotal + tax − discount, floored at 0. Tax and discount are treated
 * as explicit non-negative cent amounts (no tax-rate policy is inferred here).
 */
export function computeInvoiceTotals<T extends InvoiceLineInput>(
  services: T[],
  taxCents: number,
  discountCents: number
): InvoiceTotals<T> {
  const tax = Math.max(0, Math.round(taxCents || 0))
  const discount = Math.max(0, Math.round(discountCents || 0))

  const lines = services.map(s => ({
    ...s,
    totalCents: Math.max(0, Math.round(s.quantity * s.unitPriceCents)),
  }))

  const subTotalCents = lines.reduce((sum, l) => sum + l.totalCents, 0)
  const totalDueCents = Math.max(0, subTotalCents + tax - discount)

  return { lines, subTotalCents, totalDueCents }
}
