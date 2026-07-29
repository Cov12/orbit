'use client'
import { useState } from 'react'

import { Invoice, InvoiceService, InvoiceStatus } from '@prisma/client'
import { ColumnDef } from '@tanstack/react-table'
import { Edit, FileText, Link2, MoreHorizontal, Trash } from 'lucide-react'
import { useRouter } from 'next/navigation'

import InvoiceForm from '@/components/forms/invoice-form'
import CustomModal from '@/components/global/custom-modal'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { toast } from '@/components/ui/use-toast'
import { deleteInvoice, markInvoiceSent } from '@/lib/queries'
import { useModal } from '@/providers/modal-provider'

type InvoiceRow = Invoice & { services: InvoiceService[] }

const statusMeta: Record<
  InvoiceStatus,
  {
    label: string
    variant: 'default' | 'secondary' | 'destructive' | 'outline'
  }
> = {
  DRAFT: { label: 'Draft', variant: 'secondary' },
  SENT: { label: 'Sent', variant: 'outline' },
  PAID: { label: 'Paid', variant: 'default' },
  OVERDUE: { label: 'Overdue', variant: 'destructive' },
  VOID: { label: 'Void', variant: 'outline' },
}

const fmt = (cents: number) =>
  new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(cents / 100)

const ActionsCell = ({ invoice }: { invoice: InvoiceRow }) => {
  const { setOpen } = useModal()
  const router = useRouter()
  const [loading, setLoading] = useState(false)

  const handleDelete = async () => {
    setLoading(true)
    try {
      await deleteInvoice(invoice.subAccountId, invoice.id)
      toast({ title: 'Deleted', description: 'Invoice removed' })
      router.refresh()
    } catch {
      toast({
        variant: 'destructive',
        title: 'Oops!',
        description: 'Could not delete the invoice',
      })
    } finally {
      setLoading(false)
    }
  }

  const handleCopyLink = async () => {
    try {
      const { link } = await markInvoiceSent(invoice.subAccountId, invoice.id)
      const url = `${window.location.origin}/invoice/${link}`
      await navigator.clipboard.writeText(url)
      toast({
        title: 'Pay link copied',
        description: 'Share it with your customer.',
      })
      router.refresh()
    } catch {
      toast({
        variant: 'destructive',
        title: 'Oops!',
        description: 'Could not create the pay link',
      })
    }
  }

  return (
    <AlertDialog>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" className="h-8 w-8">
            <MoreHorizontal size={16} />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuLabel>Actions</DropdownMenuLabel>
          <DropdownMenuItem
            className="gap-2"
            onClick={() =>
              router.push(
                `/subaccount/${invoice.subAccountId}/invoices/${invoice.id}`
              )
            }
          >
            <FileText size={15} /> View
          </DropdownMenuItem>
          <DropdownMenuItem className="gap-2" onClick={handleCopyLink}>
            <Link2 size={15} /> Copy pay link
          </DropdownMenuItem>
          <DropdownMenuItem
            className="gap-2"
            onClick={() =>
              setOpen(
                <CustomModal
                  title="Edit Invoice"
                  subheading="Update this invoice's details."
                >
                  <InvoiceForm
                    subAccountId={invoice.subAccountId}
                    defaultData={invoice}
                  />
                </CustomModal>
              )
            }
          >
            <Edit size={15} /> Edit
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <AlertDialogTrigger asChild>
            <DropdownMenuItem
              className="gap-2 text-destructive"
              onSelect={e => e.preventDefault()}
            >
              <Trash size={15} /> Delete
            </DropdownMenuItem>
          </AlertDialogTrigger>
        </DropdownMenuContent>
      </DropdownMenu>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete this invoice?</AlertDialogTitle>
          <AlertDialogDescription>
            This permanently removes the invoice and its line items. This cannot
            be undone.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction
            disabled={loading}
            onClick={handleDelete}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            Delete
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}

export const columns: ColumnDef<InvoiceRow>[] = [
  {
    accessorKey: 'name',
    header: 'Name',
    cell: ({ row }) => <span className="font-medium">{row.original.name}</span>,
  },
  {
    accessorKey: 'status',
    header: 'Status',
    cell: ({ row }) => {
      const s = statusMeta[row.original.status]
      return <Badge variant={s.variant}>{s.label}</Badge>
    },
  },
  {
    accessorKey: 'totalDueCents',
    header: 'Amount',
    cell: ({ row }) => (
      <span className="tabular-nums">{fmt(row.original.totalDueCents)}</span>
    ),
  },
  {
    accessorKey: 'dueDate',
    header: 'Due',
    cell: ({ row }) =>
      row.original.dueDate ? (
        <span className="text-muted-foreground">
          {new Date(row.original.dueDate).toDateString()}
        </span>
      ) : (
        <span className="text-muted-foreground">—</span>
      ),
  },
  {
    id: 'actions',
    cell: ({ row }) => <ActionsCell invoice={row.original} />,
  },
]
