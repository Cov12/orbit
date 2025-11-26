import clsx from 'clsx'

import { Separator } from '@/components/ui/separator'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { addOnProducts, pricingCards } from '@/lib/constants'
import { db } from '@/lib/db'
import { stripe } from '@/lib/stripe'

import PricingCard from './_components/pricing-card'
import SubscriptionHelper from './_components/subscription-helper'

type Props = {
  params: Promise<{ businessId: string }>
}

const page = async ({ params }: Props) => {
  const { businessId } = await params
  //CHALLENGE : Create the add on  products
  const addOns = await stripe.products.list({
    ids: addOnProducts.map(product => product.id),
    expand: ['data.default_price'],
  })

  const businessSubscription = await db.business.findUnique({
    where: {
      id: businessId,
    },
    select: {
      customerId: true,
      Subscription: true,
    },
  })

  const prices = await stripe.prices.list({
    product: process.env.NEXT_WORKPIPE_PRODUCT_ID,
    active: true,
  })

  const currentPlanDetails = await pricingCards.find(
    c => c.priceId === businessSubscription?.Subscription?.priceId
  )

  let allCharges: any[] = []
  if (businessSubscription?.customerId) {
    const charges = await stripe.charges.list({
      limit: 50,
      customer: businessSubscription.customerId,
    })

    allCharges = [
      ...charges.data.map(charge => ({
        description: charge.description,
        id: charge.id,
        date: `${new Date(charge.created * 1000).toLocaleTimeString()} ${new Date(
          charge.created * 1000
        ).toLocaleDateString()}`,
        status: 'Paid',
        amount: `$${charge.amount / 100}`,
      })),
    ]
  }
  businessSubscription
  console.log('businessSubscription: ', businessSubscription)
  console.log('currentPlanDetails: ', currentPlanDetails)
  console.log('businessId: ', businessId)

  return (
    <>
      <SubscriptionHelper
        prices={prices.data}
        customerId={businessSubscription?.customerId || ''}
        planExists={businessSubscription?.Subscription?.active === true}
      />
      <h1 className="p-4 text-4xl">Billing</h1>
      <Separator className="mb-6" />
      <h2 className="p-4 text-2xl">Current Plan</h2>
      <div className="flex flex-col justify-between gap-8 lg:!flex-row">
        <PricingCard
          planExists={businessSubscription?.Subscription?.active === true}
          prices={prices.data}
          customerId={businessSubscription?.customerId || ''}
          amt={
            businessSubscription?.Subscription?.active === true
              ? currentPlanDetails?.price || '$0'
              : '$0'
          }
          buttonCta={
            businessSubscription?.Subscription?.active === true
              ? 'Change Plan'
              : 'Get Started'
          }
          highlightDescription="Want to modify your plan? You can do this here. If you have
          further question contact support"
          highlightTitle="Plan Options"
          description={
            businessSubscription?.Subscription?.active === true
              ? currentPlanDetails?.description || 'Lets get started'
              : 'Lets get started! Pick a plan that works best for you.'
          }
          duration="/ month"
          features={
            businessSubscription?.Subscription?.active === true
              ? currentPlanDetails?.features || []
              : currentPlanDetails?.features ||
                pricingCards.find(pricing => pricing.title === 'Starter')
                  ?.features ||
                []
          }
          title={
            businessSubscription?.Subscription?.active === true
              ? currentPlanDetails?.title || 'Starter'
              : 'Starter'
          }
        />
        {addOns.data.map(addOn => (
          <PricingCard
            planExists={businessSubscription?.Subscription?.active === true}
            prices={prices.data}
            customerId={businessSubscription?.customerId || ''}
            key={addOn.id}
            amt={
              //@ts-ignore
              addOn.default_price?.unit_amount
                ? //@ts-ignore
                  `$${addOn.default_price.unit_amount / 100}`
                : '$0'
            }
            buttonCta="Subscribe"
            description="Dedicated support line & teams channel for support"
            duration="/ month"
            features={[]}
            title={'24/7 priority support'}
            highlightTitle="Get support now!"
            highlightDescription="Get priority support and skip the long long with the click of a button."
          />
        ))}
      </div>
      <h2 className="p-4 text-2xl">Payment History</h2>
      <Table className="rounded-md border-[1px] border-border bg-card">
        <TableHeader className="rounded-md">
          <TableRow>
            <TableHead className="w-[200px]">Description</TableHead>
            <TableHead className="w-[200px]">Invoice Id</TableHead>
            <TableHead className="w-[300px]">Date</TableHead>
            <TableHead className="w-[200px]">Paid</TableHead>
            <TableHead className="text-right">Amount</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody className="truncate font-medium">
          {allCharges.map(charge => (
            <TableRow key={charge.id}>
              <TableCell>{charge.description}</TableCell>
              <TableCell className="text-muted-foreground">
                {charge.id}
              </TableCell>
              <TableCell>{charge.date}</TableCell>
              <TableCell>
                <p
                  className={clsx('', {
                    'text-emerald-500': charge.status.toLowerCase() === 'paid',
                    'text-orange-600':
                      charge.status.toLowerCase() === 'pending',
                    'text-red-600': charge.status.toLowerCase() === 'failed',
                  })}
                >
                  {charge.status.toUpperCase()}
                </p>
              </TableCell>
              <TableCell className="text-right">{charge.amount}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </>
  )

  // return (
  //   <>
  //     <SubscriptionHelper
  //       prices={prices.data}
  //       customerId={businessSubscription?.customerId || ''}
  //       planExists={businessSubscription?.Subscription?.active === true}
  //     />
  //     <h1 className="text-4xl p-4">Billing</h1>
  //     <Separator className=" mb-6" />
  //     <h2 className="text-2xl p-4">Available Plans</h2>
  //     <div className="flex flex-col lg:!flex-row justify-between gap-8">
  //       {prices.data.map((price) => {
  //         const planDetails = pricingCards.find((card) => card.priceId === price.id);
  //         const isCurrentPlan = businessSubscription?.Subscription?.priceId === price.id;

  //         return (
  //           <PricingCard
  //             key={price.id}
  //             planExists={businessSubscription?.Subscription?.active === true}
  //             prices={prices.data}
  //             customerId={businessSubscription?.customerId || ''}
  //             amt={price.unit_amount ? `$${price.unit_amount / 100}` : '$0'}
  //             buttonCta={isCurrentPlan ? 'Change Plan' : 'Get Started'}
  //             highlightDescription="Want to modify your plan? You can do this here. If you have further question contact support"
  //             highlightTitle="Plan Options"
  //             description={planDetails?.description || 'Lets get started! Pick a plan that works best for you.'}
  //             duration="/ month"
  //             features={planDetails?.features || []}
  //             title={planDetails?.title || 'Starter'}
  //             priceId={price.id}
  //           />
  //         );
  //       })}
  //       {addOns.data.map((addOn) => (
  //         <PricingCard
  //           priceId={addOn.id}
  //           planExists={businessSubscription?.Subscription?.active === true}
  //           prices={prices.data}
  //           customerId={businessSubscription?.customerId || ''}
  //           key={addOn.id}
  //           amt={
  //             //@ts-ignore
  //             addOn.default_price?.unit_amount
  //               ? //@ts-ignore
  //                 `$${addOn.default_price.unit_amount / 100}`
  //               : '$0'
  //           }
  //           buttonCta="Subscribe"
  //           description="Dedicated support line & teams channel for support"
  //           duration="/ month"
  //           features={[]}
  //           title={'24/7 priority support'}
  //           highlightTitle="Get support now!"
  //           highlightDescription="Get priority support and skip the long long with the click of a button."
  //         />
  //       ))}
  //     </div>
  //     <h2 className="text-2xl p-4">Payment History</h2>
  //     <Table className="bg-card border-[1px] border-border rounded-md">
  //       <TableHeader className="rounded-md">
  //         <TableRow>
  //           <TableHead className="w-[200px]">Description</TableHead>
  //           <TableHead className="w-[200px]">Invoice Id</TableHead>
  //           <TableHead className="w-[300px]">Date</TableHead>
  //           <TableHead className="w-[200px]">Paid</TableHead>
  //           <TableHead className="text-right">Amount</TableHead>
  //         </TableRow>
  //       </TableHeader>
  //       <TableBody className="font-medium truncate">
  //         {allCharges.map((charge) => (
  //           <TableRow key={charge.id}>
  //             <TableCell>{charge.description}</TableCell>
  //             <TableCell className="text-muted-foreground">
  //               {charge.id}
  //             </TableCell>
  //             <TableCell>{charge.date}</TableCell>
  //             <TableCell>
  //               <p
  //                 className={clsx('', {
  //                   'text-emerald-500': charge.status.toLowerCase() === 'paid',
  //                   'text-orange-600':
  //                     charge.status.toLowerCase() === 'pending',
  //                   'text-red-600': charge.status.toLowerCase() === 'failed',
  //                 })}
  //               >
  //                 {charge.status.toUpperCase()}
  //               </p>
  //             </TableCell>
  //             <TableCell className="text-right">{charge.amount}</TableCell>
  //           </TableRow>
  //         ))}
  //       </TableBody>
  //     </Table>
  //   </>
  // )
}

export default page
