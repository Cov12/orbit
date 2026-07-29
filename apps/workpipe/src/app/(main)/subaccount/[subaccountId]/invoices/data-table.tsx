'use client'
import React from 'react'

import {
  ColumnDef,
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  useReactTable,
} from '@tanstack/react-table'
import { Search } from 'lucide-react'

import CustomModal from '@/components/global/custom-modal'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { useModal } from '@/providers/modal-provider'

interface InvoicesDataTableProps<TData, TValue> {
  columns: ColumnDef<TData, TValue>[]
  data: TData[]
  filterValue: string
  actionButtonText?: React.ReactNode
  modalChildren?: React.ReactNode
}

export default function InvoicesDataTable<TData, TValue>({
  columns,
  data,
  filterValue,
  modalChildren,
  actionButtonText,
}: InvoicesDataTableProps<TData, TValue>) {
  const { setOpen } = useModal()

  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
  })

  return (
    <>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 py-4">
          <Search />
          <Input
            placeholder="Search invoices..."
            value={
              (table.getColumn(filterValue)?.getFilterValue() as string) ?? ''
            }
            onChange={event =>
              table.getColumn(filterValue)?.setFilterValue(event.target.value)
            }
            className="h-12"
          />
        </div>
        <Button
          className="flex gap-2"
          onClick={() => {
            if (modalChildren)
              setOpen(
                <CustomModal
                  title="Create an Invoice"
                  subheading="Bill a customer for products or services."
                >
                  {modalChildren}
                </CustomModal>
              )
          }}
        >
          {actionButtonText}
        </Button>
      </div>
      <div className="rounded-lg border bg-background">
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map(headerGroup => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map(header => (
                  <TableHead key={header.id}>
                    {header.isPlaceholder
                      ? null
                      : flexRender(
                          header.column.columnDef.header,
                          header.getContext()
                        )}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {table.getRowModel().rows.length ? (
              table.getRowModel().rows.map(row => (
                <TableRow key={row.id}>
                  {row.getVisibleCells().map(cell => (
                    <TableCell key={cell.id}>
                      {flexRender(
                        cell.column.columnDef.cell,
                        cell.getContext()
                      )}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell
                  colSpan={columns.length}
                  className="h-24 text-center"
                >
                  No invoices yet.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </>
  )
}
