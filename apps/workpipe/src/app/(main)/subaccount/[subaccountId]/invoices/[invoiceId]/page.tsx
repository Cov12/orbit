import { ArrowLeft } from 'lucide-react'
import Link from 'next/link'
import { notFound } from 'next/navigation'

import BlurPage from '@/components/global/blur-page'
import InvoiceDocument from '@/components/global/invoice-document'
import PrintInvoiceButton from '@/components/global/print-invoice-button'
import { Button } from '@/components/ui/button'
import { getInvoice, getSubaccountDetails } from '@/lib/queries'

const InvoiceViewPage = async ({
  params,
}: {
  params: Promise<{ subaccountId: string; invoiceId: string }>
}) => {
  const { subaccountId, invoiceId } = await params
  const invoice = await getInvoice(invoiceId)
  // Scope to the sub-account in the URL so an invoice can't be viewed by
  // guessing an id under another sub-account.
  if (!invoice || invoice.subAccountId !== subaccountId) return notFound()

  const subaccount = await getSubaccountDetails(subaccountId)

  return (
    <BlurPage>
      <div className="no-print mb-4 flex items-center justify-between">
        <Link href={`/subaccount/${subaccountId}/invoices`}>
          <Button variant="ghost" className="gap-2">
            <ArrowLeft size={15} /> Back to invoices
          </Button>
        </Link>
        <PrintInvoiceButton />
      </div>
      <InvoiceDocument invoice={invoice} subaccount={subaccount} />
    </BlurPage>
  )
}

export default InvoiceViewPage
