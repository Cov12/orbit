import { Plus } from 'lucide-react'

import InvoiceForm from '@/components/forms/invoice-form'
import BlurPage from '@/components/global/blur-page'
import { getInvoices } from '@/lib/queries'

import { columns } from './columns'
import InvoicesDataTable from './data-table'

const InvoicesPage = async ({
  params,
}: {
  params: Promise<{ subaccountId: string }>
}) => {
  const { subaccountId } = await params
  const invoices = await getInvoices(subaccountId)

  return (
    <BlurPage>
      <InvoicesDataTable
        actionButtonText={
          <>
            <Plus size={15} />
            Create Invoice
          </>
        }
        modalChildren={<InvoiceForm subAccountId={subaccountId} />}
        filterValue="name"
        columns={columns}
        data={invoices}
      />
    </BlurPage>
  )
}

export default InvoicesPage
