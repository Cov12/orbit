import { Invoice, InvoiceService, SubAccount } from '@prisma/client'

type InvoiceWithServices = Invoice & { services: InvoiceService[] }

const statusLabel: Record<string, string> = {
  DRAFT: 'Draft',
  SENT: 'Sent',
  PAID: 'Paid',
  OVERDUE: 'Overdue',
  VOID: 'Void',
}

const dateStr = (d?: Date | null) =>
  d
    ? new Date(d).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      })
    : '—'

/**
 * Print-optimized invoice document. Rendered with explicit light styling (white
 * ground / dark ink) so "Save as PDF" via the browser looks right regardless of
 * the app theme. The `#invoice-print-root` id is what the print stylesheet in
 * globals.css isolates.
 */
export default function InvoiceDocument({
  invoice,
  subaccount,
}: {
  invoice: InvoiceWithServices
  subaccount: SubAccount | null
}) {
  const currency = (invoice.currency || 'usd').toUpperCase()
  const fmt = (cents: number) =>
    new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(
      cents / 100
    )

  return (
    <div
      id="invoice-print-root"
      className="mx-auto w-full max-w-3xl rounded-xl border bg-white p-8 text-black shadow-sm print:border-0 print:shadow-none"
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          {subaccount?.subAccountLogo ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={subaccount.subAccountLogo}
              alt=""
              className="h-12 w-12 rounded object-cover"
            />
          ) : null}
          <div>
            <p className="text-lg font-semibold">
              {subaccount?.name ?? 'Invoice'}
            </p>
            {subaccount?.companyEmail ? (
              <p className="text-sm text-gray-500">{subaccount.companyEmail}</p>
            ) : null}
          </div>
        </div>
        <div className="text-right">
          <h1 className="text-2xl font-bold tracking-tight">INVOICE</h1>
          {invoice.number ? (
            <p className="text-sm text-gray-500">#{invoice.number}</p>
          ) : null}
          <span className="mt-1 inline-block rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium">
            {statusLabel[invoice.status] ?? invoice.status}
          </span>
        </div>
      </div>

      <div className="mt-6 grid grid-cols-2 gap-4 text-sm">
        <div>
          <p className="text-gray-500">Reference</p>
          <p className="font-medium">{invoice.name}</p>
        </div>
        <div className="text-right">
          <p className="text-gray-500">Issued</p>
          <p className="font-medium">{dateStr(invoice.createdAt)}</p>
          <p className="mt-1 text-gray-500">Due</p>
          <p className="font-medium">{dateStr(invoice.dueDate)}</p>
        </div>
      </div>

      <table className="mt-6 w-full text-sm">
        <thead>
          <tr className="border-b text-left text-gray-500">
            <th className="py-2 font-medium">Item</th>
            <th className="py-2 text-right font-medium">Qty</th>
            <th className="py-2 text-right font-medium">Unit</th>
            <th className="py-2 text-right font-medium">Amount</th>
          </tr>
        </thead>
        <tbody>
          {invoice.services.map(s => (
            <tr key={s.id} className="border-b align-top">
              <td className="py-2">
                <p className="font-medium">{s.name}</p>
                {s.description ? (
                  <p className="text-gray-500">{s.description}</p>
                ) : null}
              </td>
              <td className="py-2 text-right tabular-nums">{s.quantity}</td>
              <td className="py-2 text-right tabular-nums">
                {fmt(s.unitPriceCents)}
              </td>
              <td className="py-2 text-right tabular-nums">
                {fmt(s.totalCents)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="mt-4 flex justify-end">
        <div className="w-full max-w-xs space-y-1 text-sm tabular-nums">
          <div className="flex justify-between text-gray-500">
            <span>Subtotal</span>
            <span>{fmt(invoice.subTotalCents)}</span>
          </div>
          <div className="flex justify-between text-gray-500">
            <span>Tax</span>
            <span>{fmt(invoice.taxCents)}</span>
          </div>
          <div className="flex justify-between text-gray-500">
            <span>Discount</span>
            <span>−{fmt(invoice.discountCents)}</span>
          </div>
          <div className="flex justify-between border-t pt-2 text-base font-semibold">
            <span>Total due</span>
            <span>{fmt(invoice.totalDueCents)}</span>
          </div>
        </div>
      </div>

      {invoice.netPaymentTerm ? (
        <p className="mt-6 text-xs text-gray-500">
          Payment terms: {invoice.netPaymentTerm}
        </p>
      ) : null}
    </div>
  )
}
