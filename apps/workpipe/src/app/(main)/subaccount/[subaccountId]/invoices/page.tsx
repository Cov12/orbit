import { Plus } from 'lucide-react'

import InvoiceForm from '@/components/forms/invoice-form'
import BlurPage from '@/components/global/blur-page'
import { getInvoices } from '@/lib/queries'

import { columns } from './columns'
import InvoicesDataTable from './data-table'
import InvoiceSummary, { type InvoiceMetric } from './invoice-summary'

const InvoicesPage = async ({
  params,
}: {
  params: Promise<{ subaccountId: string }>
}) => {
  const { subaccountId } = await params
  const invoices = await getInvoices(subaccountId)

  // Summary metrics. PAID = collected; OVERDUE = unpaid past its due date;
  // PENDING = the rest that's still owed. VOID invoices are excluded entirely.
  // Pending and Overdue are disjoint so the three buckets don't double-count.
  const now = new Date()
  const paid: InvoiceMetric = { cents: 0, count: 0 }
  const pending: InvoiceMetric = { cents: 0, count: 0 }
  const overdue: InvoiceMetric = { cents: 0, count: 0 }
  for (const inv of invoices) {
    if (inv.status === 'VOID') continue
    if (inv.status === 'PAID') {
      paid.cents += inv.totalDueCents
      paid.count += 1
      continue
    }
    const bucket =
      inv.dueDate && new Date(inv.dueDate) < now ? overdue : pending
    bucket.cents += inv.totalDueCents
    bucket.count += 1
  }

  return (
    <BlurPage>
      <div className="flex flex-col gap-4 pb-6">
        <InvoiceSummary paid={paid} pending={pending} overdue={overdue} />
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
      </div>
    </BlurPage>
  )
}

export default InvoicesPage
