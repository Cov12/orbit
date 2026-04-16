import { NextResponse } from 'next/server'

import { db } from '@/lib/db'
import { stripe } from '@/lib/stripe'

export async function POST(req: Request) {
  const { customerId, priceId } = await req.json()
  if (!customerId || !priceId)
    return new NextResponse('Customer Id or price id is missing', {
      status: 400,
    })

  const subscriptionExists = await db.business.findFirst({
    where: { customerId },
    include: { Subscription: true },
  })

  try {
    if (
      subscriptionExists?.Subscription &&
      subscriptionExists.Subscription.subscritiptionId &&
      subscriptionExists.Subscription.active
    ) {
      // Try to update the existing subscription.
      console.log('Updating the subscription')
      try {
        const currentSubscriptionDetails = await stripe.subscriptions.retrieve(
          subscriptionExists.Subscription.subscritiptionId
        )

        const subscription = await stripe.subscriptions.update(
          subscriptionExists.Subscription.subscritiptionId,
          {
            items: [
              {
                id: currentSubscriptionDetails.items.data[0].id,
                deleted: true,
              },
              { price: priceId },
            ],
            expand: ['latest_invoice.payment_intent'],
          }
        )
        return NextResponse.json({
          subscriptionId: subscription.id,
          //@ts-ignore
          clientSecret:
            subscription.latest_invoice.payment_intent.client_secret,
        })
      } catch (err: any) {
        // Stale subscription (e.g. Stripe account switched) — clean up and fall through to create new.
        if (err?.code === 'resource_missing') {
          console.log(
            '⚠️  Stale subscription detected, clearing DB record:',
            subscriptionExists.Subscription.subscritiptionId
          )
          await db.subscription
            .delete({
              where: { businessId: subscriptionExists.id },
            })
            .catch(e => console.log('Subscription cleanup failed:', e))
          // fall through to create-new path below
        } else {
          throw err
        }
      }
    }
    // Create a new subscription (either no existing sub, or stale one was cleared)
    {
      console.log('Createing a sub')
      const subscription = await stripe.subscriptions.create({
        customer: customerId,
        items: [
          {
            price: priceId,
          },
        ],
        payment_behavior: 'default_incomplete',
        payment_settings: { save_default_payment_method: 'on_subscription' },
        expand: ['latest_invoice.payment_intent'],
      })
      return NextResponse.json({
        subscriptionId: subscription.id,
        //@ts-ignore
        clientSecret: subscription.latest_invoice.payment_intent.client_secret,
      })
    }
  } catch (error) {
    console.log('🔴 Error', error)
    return new NextResponse('Internal Server Error', {
      status: 500,
    })
  }
}
