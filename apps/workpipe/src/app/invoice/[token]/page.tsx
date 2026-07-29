import { notFound } from 'next/navigation'

import InvoiceDocument from '@/components/global/invoice-document'
import { getInvoiceByLink } from '@/lib/queries'

// Public, token-authorized invoice pay/view page. No login: possession of the
// unguessable link IS the authorization. INV-6 will add a "Pay now" button here
// when the sub-account has Stripe Connect connected.
const PublicInvoicePage = async ({
  params,
}: {
  params: Promise<{ token: string }>
}) => {
  const { token } = await params
  const invoice = await getInvoiceByLink(token)
  if (!invoice) return notFound()

  return (
    <div className="min-h-screen bg-muted/30 px-4 py-10">
      <div className="mx-auto max-w-3xl">
        <InvoiceDocument invoice={invoice} subaccount={invoice.Subaccount} />
      </div>
    </div>
  )
}

export default PublicInvoicePage
