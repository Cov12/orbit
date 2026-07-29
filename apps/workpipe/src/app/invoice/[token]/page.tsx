import { notFound } from 'next/navigation'

import InvoiceDocument from '@/components/global/invoice-document'
import PayInvoiceButton from '@/components/global/pay-invoice-button'
import { getInvoiceByLink } from '@/lib/queries'

// Public, token-authorized invoice pay/view page. No login: possession of the
// unguessable link IS the authorization.
const PublicInvoicePage = async ({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>
  searchParams: Promise<{ paid?: string }>
}) => {
  const { token } = await params
  const { paid: paidReturn } = await searchParams
  const invoice = await getInvoiceByLink(token)
  if (!invoice) return notFound()

  const isPaid = invoice.status === 'PAID'
  // Just came back from a successful checkout, but the webhook may not have
  // flipped the status yet (it's async) — show a confirming state.
  const confirming = !isPaid && paidReturn === '1'
  const canPay =
    !isPaid &&
    !confirming &&
    invoice.totalDueCents > 0 &&
    !!invoice.Subaccount?.connectAccountId

  const amountLabel = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: (invoice.currency || 'usd').toUpperCase(),
  }).format(invoice.totalDueCents / 100)

  return (
    <div className="min-h-screen bg-muted/30 px-4 py-10">
      <div className="mx-auto max-w-3xl">
        {isPaid && (
          <div className="mb-4 rounded-lg border border-emerald-300 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-800">
            This invoice has been paid. Thank you!
          </div>
        )}
        {confirming && (
          <div className="mb-4 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm font-medium text-amber-800">
            Payment received — confirming with your bank. This page will update
            shortly.
          </div>
        )}

        <InvoiceDocument invoice={invoice} subaccount={invoice.Subaccount} />

        {canPay && (
          <div className="mt-6 flex justify-end">
            <PayInvoiceButton token={token} amountLabel={amountLabel} />
          </div>
        )}
      </div>
    </div>
  )
}

export default PublicInvoicePage
