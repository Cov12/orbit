'use client'
import React from 'react'

import { zodResolver } from '@hookform/resolvers/zod'
import { Invoice, InvoiceService } from '@prisma/client'
import { Plus, Trash2 } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useFieldArray, useForm } from 'react-hook-form'
import { z } from 'zod'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import { computeInvoiceTotals } from '@/lib/invoice-totals'
import { upsertInvoice } from '@/lib/queries'
import { useModal } from '@/providers/modal-provider'

import Loading from '../global/loading'
import { Button } from '../ui/button'
import { Input } from '../ui/input'
import { toast } from '../ui/use-toast'

type InvoiceWithServices = Invoice & { services: InvoiceService[] }

interface InvoiceFormProps {
  subAccountId: string
  defaultData?: InvoiceWithServices
}

// Client-facing schema works in DOLLARS for usability; amounts are converted to
// integer cents on submit. The server (upsertInvoice) re-validates and is the
// authority on every computed amount — this is purely for UX + inline errors.
const InvoiceUiSchema = z.object({
  name: z.string().min(1, 'Required'),
  type: z.string().optional(),
  dueDate: z.string().optional(),
  netPaymentTerm: z.string().optional(),
  taxDollars: z.coerce.number().min(0).default(0),
  discountDollars: z.coerce.number().min(0).default(0),
  services: z
    .array(
      z.object({
        name: z.string().min(1, 'Required'),
        description: z.string().optional(),
        quantity: z.coerce.number().int().min(1).default(1),
        unitPriceDollars: z.coerce.number().min(0).default(0),
      })
    )
    .min(1, 'Add at least one line item'),
})

type InvoiceUiValues = z.infer<typeof InvoiceUiSchema>

const toCents = (dollars: number) => Math.max(0, Math.round(dollars * 100))
const fmt = (cents: number) =>
  new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(cents / 100)

const InvoiceForm: React.FC<InvoiceFormProps> = ({
  subAccountId,
  defaultData,
}) => {
  const { setClose } = useModal()
  const router = useRouter()

  const form = useForm<InvoiceUiValues>({
    mode: 'onChange',
    resolver: zodResolver(InvoiceUiSchema),
    defaultValues: {
      name: defaultData?.name ?? '',
      type: defaultData?.type ?? '',
      dueDate: defaultData?.dueDate
        ? new Date(defaultData.dueDate).toISOString().slice(0, 10)
        : '',
      netPaymentTerm: defaultData?.netPaymentTerm ?? '',
      taxDollars: (defaultData?.taxCents ?? 0) / 100,
      discountDollars: (defaultData?.discountCents ?? 0) / 100,
      services:
        defaultData?.services && defaultData.services.length
          ? defaultData.services.map(s => ({
              name: s.name,
              description: s.description ?? '',
              quantity: s.quantity,
              unitPriceDollars: s.unitPriceCents / 100,
            }))
          : [{ name: '', description: '', quantity: 1, unitPriceDollars: 0 }],
    },
  })

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: 'services',
  })

  // Live preview via the SAME pure math the server uses — the displayed total is
  // exactly what will be persisted.
  const watched = form.watch()
  const preview = computeInvoiceTotals(
    (watched.services ?? []).map(s => ({
      quantity: Number(s?.quantity) || 0,
      unitPriceCents: toCents(Number(s?.unitPriceDollars) || 0),
    })),
    toCents(Number(watched.taxDollars) || 0),
    toCents(Number(watched.discountDollars) || 0)
  )

  const isSubmitting = form.formState.isSubmitting

  const onSubmit = async (values: InvoiceUiValues) => {
    try {
      const invoice = await upsertInvoice(
        subAccountId,
        {
          name: values.name,
          type: values.type || undefined,
          dueDate: values.dueDate ? new Date(values.dueDate) : undefined,
          netPaymentTerm: values.netPaymentTerm || undefined,
          currency: 'usd',
          taxCents: toCents(values.taxDollars),
          discountCents: toCents(values.discountDollars),
          services: values.services.map(s => ({
            name: s.name,
            description: s.description || undefined,
            quantity: s.quantity,
            unitPriceCents: toCents(s.unitPriceDollars),
          })),
        },
        defaultData?.id
      )
      toast({ title: 'Success', description: `Saved invoice ${invoice.name}` })
      setClose()
      router.refresh()
    } catch (error) {
      console.error('Error saving invoice:', error)
      toast({
        variant: 'destructive',
        title: 'Oops!',
        description: 'Could not save the invoice. Please try again.',
      })
    }
  }

  return (
    <Card className="flex-1">
      <CardHeader>
        <CardTitle>{defaultData ? 'Edit Invoice' : 'New Invoice'}</CardTitle>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form
            onSubmit={form.handleSubmit(onSubmit)}
            className="flex flex-col gap-4"
          >
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Invoice Name</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g. September Retainer" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <FormField
                control={form.control}
                name="dueDate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Due Date</FormLabel>
                    <FormControl>
                      <Input type="date" {...field} />
                    </FormControl>
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="netPaymentTerm"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Payment Terms</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g. Net 30" {...field} />
                    </FormControl>
                  </FormItem>
                )}
              />
            </div>

            {/* Line items */}
            <div className="flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <FormLabel>Line Items</FormLabel>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="gap-1"
                  onClick={() =>
                    append({
                      name: '',
                      description: '',
                      quantity: 1,
                      unitPriceDollars: 0,
                    })
                  }
                >
                  <Plus size={14} /> Add item
                </Button>
              </div>

              {fields.map((fieldItem, index) => {
                const line = watched.services?.[index]
                const lineTotal =
                  (Number(line?.quantity) || 0) *
                  toCents(Number(line?.unitPriceDollars) || 0)
                return (
                  <div
                    key={fieldItem.id}
                    className="grid grid-cols-12 items-end gap-2 rounded-lg border p-3"
                  >
                    <FormField
                      control={form.control}
                      name={`services.${index}.name`}
                      render={({ field }) => (
                        <FormItem className="col-span-12 sm:col-span-5">
                          <FormLabel className="text-xs">Item</FormLabel>
                          <FormControl>
                            <Input placeholder="Description" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name={`services.${index}.quantity`}
                      render={({ field }) => (
                        <FormItem className="col-span-4 sm:col-span-2">
                          <FormLabel className="text-xs">Qty</FormLabel>
                          <FormControl>
                            <Input type="number" min={1} step={1} {...field} />
                          </FormControl>
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name={`services.${index}.unitPriceDollars`}
                      render={({ field }) => (
                        <FormItem className="col-span-5 sm:col-span-3">
                          <FormLabel className="text-xs">Unit price</FormLabel>
                          <FormControl>
                            <Input
                              type="number"
                              min={0}
                              step="0.01"
                              placeholder="0.00"
                              {...field}
                            />
                          </FormControl>
                        </FormItem>
                      )}
                    />
                    <div className="col-span-2 pb-2 text-right text-sm tabular-nums text-muted-foreground sm:col-span-1">
                      {fmt(lineTotal)}
                    </div>
                    <div className="col-span-1 flex justify-end pb-1">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-muted-foreground hover:text-destructive"
                        disabled={fields.length === 1}
                        onClick={() => remove(index)}
                        aria-label="Remove line item"
                      >
                        <Trash2 size={14} />
                      </Button>
                    </div>
                  </div>
                )
              })}
              {form.formState.errors.services?.message && (
                <p className="text-sm text-destructive">
                  {form.formState.errors.services.message}
                </p>
              )}
            </div>

            {/* Tax / discount */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <FormField
                control={form.control}
                name="taxDollars"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Tax</FormLabel>
                    <FormControl>
                      <Input type="number" min={0} step="0.01" {...field} />
                    </FormControl>
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="discountDollars"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Discount</FormLabel>
                    <FormControl>
                      <Input type="number" min={0} step="0.01" {...field} />
                    </FormControl>
                  </FormItem>
                )}
              />
            </div>

            {/* Totals preview */}
            <div className="flex flex-col gap-1 rounded-lg bg-muted/50 p-4 text-sm tabular-nums">
              <div className="flex justify-between text-muted-foreground">
                <span>Subtotal</span>
                <span>{fmt(preview.subTotalCents)}</span>
              </div>
              <div className="flex justify-between text-muted-foreground">
                <span>Tax</span>
                <span>{fmt(toCents(Number(watched.taxDollars) || 0))}</span>
              </div>
              <div className="flex justify-between text-muted-foreground">
                <span>Discount</span>
                <span>
                  −{fmt(toCents(Number(watched.discountDollars) || 0))}
                </span>
              </div>
              <div className="mt-1 flex justify-between border-t pt-2 font-semibold">
                <span>Total due</span>
                <span>{fmt(preview.totalDueCents)}</span>
              </div>
            </div>

            <Button className="mt-2 w-24" disabled={isSubmitting} type="submit">
              {isSubmitting ? <Loading /> : 'Save'}
            </Button>
          </form>
        </Form>
      </CardContent>
    </Card>
  )
}

export default InvoiceForm
