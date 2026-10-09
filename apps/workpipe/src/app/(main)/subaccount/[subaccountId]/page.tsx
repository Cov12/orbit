import { AreaChart, BadgeDelta } from '@tremor/react'
import { ClipboardIcon, Contact2, DollarSign, ShoppingCart } from 'lucide-react'
import Link from 'next/link'

import BlurPage from '@/components/global/blur-page'
import CircleProgress from '@/components/global/circle-progress'
import PipelineValue from '@/components/global/pipeline-value'
import SubaccountFunnelChart from '@/components/global/subaccount-funnel-chart'
import { Badge } from '@/components/ui/badge'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { db } from '@/lib/db'
import { isStripeConnectConfigured } from '@/lib/deployment'
import { stripe } from '@/lib/stripe'

type Props = {
  params: Promise<{ subaccountId: string }>
  searchParams: Promise<{
    code: string
  }>
}

const SubaccountPageId = async ({ params, searchParams }: Props) => {
  const { subaccountId } = await params
  let currency = 'USD'
  let sessions
  let totalClosedSessions
  let totalPendingSessions
  let net = 0
  let potentialIncome = 0
  let closingRate = 0

  const subaccountDetails = await db.subAccount.findUnique({
    where: {
      id: subaccountId,
    },
  })

  const currentYear = new Date().getFullYear()
  const startDate = new Date(`${currentYear}-01-01T00:00:00Z`).getTime() / 1000
  const endDate = new Date(`${currentYear}-12-31T23:59:59Z`).getTime() / 1000

  if (!subaccountDetails) return

  if (subaccountDetails.connectAccountId) {
    const response = await stripe.accounts.retrieve({
      stripeAccount: subaccountDetails.connectAccountId,
    })
    currency = response.default_currency?.toUpperCase() || 'USD'
    const checkoutSessions = await stripe.checkout.sessions.list(
      { created: { gte: startDate, lte: endDate }, limit: 100 },
      {
        stripeAccount: subaccountDetails.connectAccountId,
      }
    )
    sessions = checkoutSessions.data.map(session => ({
      ...session,
      created: new Date(session.created).toLocaleDateString(),
      amount_total: session.amount_total ? session.amount_total / 100 : 0,
    }))

    totalClosedSessions = checkoutSessions.data
      .filter(session => session.status === 'complete')
      .map(session => ({
        ...session,
        created: new Date(session.created).toLocaleDateString(),
        amount_total: session.amount_total ? session.amount_total / 100 : 0,
      }))

    totalPendingSessions = checkoutSessions.data
      .filter(
        session => session.status === 'open' || session.status === 'expired'
      )
      .map(session => ({
        ...session,
        created: new Date(session.created).toLocaleDateString(),
        amount_total: session.amount_total ? session.amount_total / 100 : 0,
      }))

    net = +totalClosedSessions
      .reduce((total, session) => total + (session.amount_total || 0), 0)
      .toFixed(2)

    potentialIncome = +totalPendingSessions
      .reduce((total, session) => total + (session.amount_total || 0), 0)
      .toFixed(2)

    closingRate = +(
      (totalClosedSessions.length / checkoutSessions.data.length) *
      100
    ).toFixed(2)
  }

  const funnels = await db.funnel.findMany({
    where: {
      subAccountId: subaccountId,
    },
    include: {
      FunnelPages: true,
    },
  })

  const funnelPerformanceMetrics = funnels.map(funnel => ({
    ...funnel,
    totalFunnelVisits: funnel.FunnelPages.reduce(
      (total, page) => total + page.visits,
      0
    ),
  }))

  return (
    <BlurPage>
      <div className="relative h-full">
        {/* Stripe Connect is optional — surface a non-blocking CTA instead of
            gating the whole dashboard. Payment-derived metrics below already
            self-disable to $0 when no account is connected. Mirrors the
            business-tier soft CTA. */}
        {!subaccountDetails.connectAccountId && !isStripeConnectConfigured() && (
          <p className="mb-6 text-sm text-muted-foreground">
            Payments aren’t enabled for this workspace, so revenue and checkout
            figures below stay at $0. Pipeline value is tracked from your deals.
          </p>
        )}
        {!subaccountDetails.connectAccountId && isStripeConnectConfigured() && (
          <Card className="mb-6 border-blue-200 bg-blue-50/50 dark:border-blue-900 dark:bg-blue-950/20">
            <CardHeader className="pb-3">
              <div className="flex items-center gap-2">
                <ClipboardIcon className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                <CardTitle className="text-lg">Connect Stripe</CardTitle>
              </div>
              <CardDescription>
                Connect a Stripe account to unlock payment metrics, funnel
                checkout, and revenue reporting. You can set this up any time.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Link
                href={`/subaccount/${subaccountDetails.id}/kickstart`}
                className="inline-flex w-fit items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
              >
                <ClipboardIcon className="h-4 w-4" />
                Launch Pad
              </Link>
            </CardContent>
          </Card>
        )}
        <div className="flex flex-col gap-4 pb-6">
          <div className="flex flex-col gap-4 xl:!flex-row">
            <Card className="relative flex-1">
              <CardHeader>
                <CardDescription>Income</CardDescription>
                <CardTitle className="text-4xl">
                  {net ? `${currency} ${net.toFixed(2)}` : `$0.00`}
                </CardTitle>
                <small className="text-xs text-muted-foreground">
                  For the year {currentYear}
                </small>
              </CardHeader>
              <CardContent className="text-sm text-muted-foreground">
                Total revenue generated as reflected in your stripe dashboard.
              </CardContent>
              <DollarSign className="absolute right-4 top-4 text-muted-foreground" />
            </Card>
            <Card className="relative flex-1">
              <CardHeader>
                <CardDescription>Potential Income</CardDescription>
                <CardTitle className="text-4xl">
                  {potentialIncome
                    ? `${currency} ${potentialIncome.toFixed(2)}`
                    : `$0.00`}
                </CardTitle>
                <small className="text-xs text-muted-foreground">
                  For the year {currentYear}
                </small>
              </CardHeader>
              <CardContent className="text-sm text-muted-foreground">
                This is how much you can close.
              </CardContent>
              <Contact2 className="absolute right-4 top-4 text-muted-foreground" />
            </Card>
            <PipelineValue subaccountId={subaccountId} />

            <Card className="xl:w-fit">
              <CardHeader>
                <CardDescription>Conversions</CardDescription>
                <CircleProgress
                  value={closingRate}
                  description={
                    <>
                      {sessions && (
                        <div className="flex flex-col">
                          Total Carts Opened
                          <div className="flex gap-2">
                            <ShoppingCart className="text-rose-700" />
                            {sessions.length}
                          </div>
                        </div>
                      )}
                      {totalClosedSessions && (
                        <div className="flex flex-col">
                          Won Carts
                          <div className="flex gap-2">
                            <ShoppingCart className="text-emerald-700" />
                            {totalClosedSessions.length}
                          </div>
                        </div>
                      )}
                    </>
                  }
                />
              </CardHeader>
            </Card>
          </div>

          <div className="flex flex-col gap-4 xl:!flex-row">
            <Card className="relative">
              <CardHeader>
                <CardDescription>Funnel Performance</CardDescription>
              </CardHeader>
              <CardContent className="flex flex-col justify-between gap-12 text-sm text-muted-foreground">
                <SubaccountFunnelChart data={funnelPerformanceMetrics} />
                <div className="lg:w-[150px]">
                  Total page visits across all funnels. Hover over to get more
                  details on funnel page performance.
                </div>
              </CardContent>
              <Contact2 className="absolute right-4 top-4 text-muted-foreground" />
            </Card>
            <Card className="flex-1 p-4">
              <CardHeader>
                <CardTitle>Checkout Activity</CardTitle>
              </CardHeader>
              <AreaChart
                className="stroke-primary text-sm"
                data={sessions || []}
                index="created"
                categories={['amount_total']}
                colors={['primary']}
                yAxisWidth={30}
                showAnimation={true}
              />
            </Card>
          </div>
          <div className="flex flex-col gap-4 xl:!flex-row">
            <Card className="relative h-[450px] flex-1 overflow-scroll p-4">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  Transition History
                  <BadgeDelta
                    className="rounded-xl bg-transparent"
                    deltaType="unchanged"
                    // isIncreasePositive={true}
                    size="xs"
                  >
                    {sessions && sessions[0]?.amount_total
                      ? sessions[0]?.amount_total
                      : 0}
                    {/* +12.3% */}
                  </BadgeDelta>
                </CardTitle>
                <Table>
                  <TableHeader className="!sticky !top-0">
                    <TableRow>
                      <TableHead className="w-[300px]">Email</TableHead>
                      <TableHead className="w-[200px]">Status</TableHead>
                      <TableHead>Created Date</TableHead>
                      <TableHead className="text-right">Value</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody className="truncate font-medium">
                    {totalClosedSessions
                      ? totalClosedSessions.map(session => (
                          <TableRow key={session.id}>
                            <TableCell>
                              {session.customer_details?.email || '-'}
                            </TableCell>
                            <TableCell>
                              <Badge className="bg-emerald-500 dark:text-black">
                                Paid
                              </Badge>
                            </TableCell>
                            <TableCell>
                              {new Date(session.created).toUTCString()}
                            </TableCell>

                            <TableCell className="text-right">
                              <small>{currency}</small>{' '}
                              <span className="text-emerald-500">
                                {session.amount_total}
                              </span>
                            </TableCell>
                          </TableRow>
                        ))
                      : 'No Data'}
                  </TableBody>
                </Table>
              </CardHeader>
            </Card>
          </div>
        </div>
      </div>
    </BlurPage>
  )
}

export default SubaccountPageId
