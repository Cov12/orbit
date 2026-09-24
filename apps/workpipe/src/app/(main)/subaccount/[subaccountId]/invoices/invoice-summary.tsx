import { AlertTriangle, CheckCircle2, Clock } from 'lucide-react'

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'

const fmt = (cents: number) =>
  new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(cents / 100)

export type InvoiceMetric = { cents: number; count: number }

export default function InvoiceSummary({
  paid,
  pending,
  overdue,
}: {
  paid: InvoiceMetric
  pending: InvoiceMetric
  overdue: InvoiceMetric
}) {
  const cards = [
    { label: 'Paid', Icon: CheckCircle2, accent: 'text-emerald-500', ...paid },
    { label: 'Pending', Icon: Clock, accent: 'text-amber-500', ...pending },
    {
      label: 'Overdue',
      Icon: AlertTriangle,
      accent: 'text-red-500',
      ...overdue,
    },
  ]

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
      {cards.map(({ label, Icon, accent, cents, count }) => (
        <Card key={label}>
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-2">
              <Icon size={16} className={accent} /> {label}
            </CardDescription>
            <CardTitle className="text-3xl tabular-nums">
              {fmt(cents)}
            </CardTitle>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground">
            {count} invoice{count === 1 ? '' : 's'}
          </CardContent>
        </Card>
      ))}
    </div>
  )
}
