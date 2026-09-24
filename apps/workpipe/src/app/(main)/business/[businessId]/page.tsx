import Link from 'next/link'

import { AreaChart } from '@tremor/react'
import {
  Contact2,
  CreditCard,
  DollarSign,
  Goal,
  ShoppingCart,
} from 'lucide-react'

import CircleProgress from '@/components/global/circle-progress'
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { Separator } from '@/components/ui/separator'
import { db } from '@/lib/db'
// import { stripe } from '@/lib/stripe'

const Page = async ({
  params,
}: {
  params: Promise<{ businessId: string }>
  searchParams: Promise<{ code: string }>
}) => {
  const { businessId } = await params
  const currency = 'USD'
  let sessions
  let totalClosedSessions
  let totalPendingSessions
  const net: number = 0
  const potentialIncome: number = 0
  const closingRate: number = 0
  const currentYear = new Date().getFullYear()
  const startDate = new Date(`${currentYear}-01-01T00:00:00Z`).getTime() / 1000
  const endDate = new Date(`${currentYear}-12-31T23:59:59Z`).getTime() / 1000

  const businessDetails = await db.business.findUnique({
    where: {
      id: businessId,
    },
  })

  if (!businessDetails) return

  const subaccounts = await db.subAccount.findMany({
    where: {
      businessId: businessId,
    },
  })

  //   if (businessDetails.connectAccountId) {
  //     const response = await stripe.accounts.retrieve({
  //       stripeAccount: businessDetails.connectAccountId,
  //     })

  //     currency = response.default_currency?.toUpperCase() || 'USD'
  //     const checkoutSessions = await stripe.checkout.sessions.list(
  //       {
  //         created: { gte: startDate, lte: endDate },
  //         limit: 100,
  //       },
  //       { stripeAccount: businessDetails.connectAccountId }
  //     )
  //     sessions = checkoutSessions.data
  //     totalClosedSessions = checkoutSessions.data
  //       .filter((session) => session.status === 'complete')
  //       .map((session) => ({
  //         ...session,
  //         created: new Date(session.created).toLocaleDateString(),
  //         amount_total: session.amount_total ? session.amount_total / 100 : 0,
  //       }))

  //     totalPendingSessions = checkoutSessions.data
  //       .filter((session) => session.status === 'open')
  //       .map((session) => ({
  //         ...session,
  //         created: new Date(session.created).toLocaleDateString(),
  //         amount_total: session.amount_total ? session.amount_total / 100 : 0,
  //       }))
  //     net = +totalClosedSessions
  //       .reduce((total, session) => total + (session.amount_total || 0), 0)
  //       .toFixed(2)

  //     potentialIncome = +totalPendingSessions
  //       .reduce((total, session) => total + (session.amount_total || 0), 0)
  //       .toFixed(2)

  //     closingRate = +(
  //       (totalClosedSessions.length / checkoutSessions.data.length) *
  //       100
  //     ).toFixed(2)
  //   }

  return (
    <div className="relative h-full">
      {/* Billing setup CTA — shown when business has no Stripe customer configured */}
      {!businessDetails.customerId && (
        <Card className="mb-6 border-blue-200 bg-blue-50/50 dark:border-blue-900 dark:bg-blue-950/20">
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <CreditCard className="h-5 w-5 text-blue-600 dark:text-blue-400" />
              <CardTitle className="text-lg">Set Up Billing</CardTitle>
            </div>
            <CardDescription>
              Set up billing to unlock premium features, manage subscriptions,
              and access advanced tools for your business.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Link
              href={`${process.env.NEXT_PUBLIC_PORTAL_URL || 'https://portal.orbit.example'}/billing`}
              className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
            >
              <CreditCard className="h-4 w-4" />
              Set Up Billing
            </Link>
          </CardContent>
        </Card>
      )}
      {/* cleanup: this forces the user to create a stripe account */}
      {/* {!businessDetails.connectAccountId && (
        <div className="absolute -top-10 -left-10 right-0 bottom-0 z-30 flex items-center justify-center backdrop-blur-md bg-background/50">
          <Card>
            <CardHeader>
              <CardTitle>Connect Your Stripe</CardTitle>
              <CardDescription>
                You need to connect your stripe account to see metrics
              </CardDescription>
              <Link
                href={`/business/${businessDetails.id}/kickstart`}
                className="p-2 w-fit bg-secondary text-white rounded-md flex items-center gap-2"
              >
                <ClipboardIcon />
                KickStart
              </Link>
            </CardHeader>
          </Card>
        </div>
      )} */}

      <h1 className="text-4xl">Dashboard</h1>
      <Separator className="my-6" />
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
            <DollarSign className="absolute right-4 top-4 text-muted-foreground" />
          </Card>
          <Card className="relative flex-1">
            <CardHeader>
              <CardDescription>Active Clients</CardDescription>
              <CardTitle className="text-4xl">{subaccounts.length}</CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground">
              Reflects the number of sub accounts you own and manage.
            </CardContent>
            <Contact2 className="absolute right-4 top-4 text-muted-foreground" />
          </Card>
          <Card className="relative flex-1">
            <CardHeader>
              <CardTitle>Business Goal</CardTitle>
              <CardDescription className="mt-2">
                Reflects the number of sub accounts you want to own and manage.
              </CardDescription>
            </CardHeader>
            <CardFooter>
              <div className="flex w-full flex-col">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">
                    Current: {subaccounts.length}
                  </span>
                  <span className="text-sm text-muted-foreground">
                    Goal: {businessDetails.goal}
                  </span>
                </div>
                <Progress
                  value={(subaccounts.length / businessDetails.goal) * 100}
                />
              </div>
            </CardFooter>
            <Goal className="absolute right-4 top-4 text-muted-foreground" />
          </Card>
        </div>
        <div className="flex flex-col gap-4 xl:!flex-row">
          <Card className="flex-1 p-4">
            <CardHeader>
              <CardTitle>Transaction History</CardTitle>
            </CardHeader>
            <AreaChart
              className="stroke-primary text-sm"
              data={[
                ...(totalClosedSessions || []),
                ...(totalPendingSessions || []),
              ]}
              index="created"
              categories={['amount_total']}
              colors={['primary']}
              yAxisWidth={30}
              showAnimation={true}
            />
          </Card>
          <Card className="w-full xl:w-[400px]">
            <CardHeader>
              <CardTitle>Conversions</CardTitle>
            </CardHeader>
            <CardContent>
              <CircleProgress
                value={closingRate}
                description={
                  <>
                    {sessions && (
                      <div className="flex flex-col">
                        Abandoned
                        <div className="flex gap-2">
                          <ShoppingCart className="text-rose-700" />
                          {/* {sessions.length} */}
                        </div>
                      </div>
                    )}
                    {totalClosedSessions && (
                      <div className="felx flex-col">
                        Won Carts
                        <div className="flex gap-2">
                          <ShoppingCart className="text-emerald-700" />
                          {/* {totalClosedSessions.length} */}
                        </div>
                      </div>
                    )}
                  </>
                }
              />
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}

export default Page
