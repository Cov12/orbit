import { NextResponse } from 'next/server'

import { stripe } from '@/lib/stripe'

export async function POST(req: Request) {
  const {
    subAccountConnectAccId,
    prices,
    subaccountId,
    funnelId,
  }: {
    subAccountConnectAccId: string
    prices: { recurring: boolean; productId: string }[]
    subaccountId: string
    funnelId?: string
  } = await req.json()

  const origin = req.headers.get('origin')
  if (!subAccountConnectAccId || !prices.length)
    return new NextResponse('Stripe Account Id or price id is missing', {
      status: 400,
    })
  if (
    !process.env.NEXT_PUBLIC_PLATFORM_SUBSCRIPTION_PERCENT ||
    !process.env.NEXT_PUBLIC_PLATFORM_ONETIME_FEE ||
    !process.env.NEXT_PUBLIC_PLATFORM_BUSINESS_PERCENT
  ) {
    console.log('VALUES DONT EXITS')
    return NextResponse.json({ error: 'Fees do not exist' })
  }

  // Not needed unless we want to send payments to this account.
  //CHALLENGE Transfer money to a connected
  // const businessIdConnectedAccountId = await db.subAccount.findUnique({
  //   where: { id: subaccountId },
  //   include: { Business: true },
  // })

  const subscriptionPriceExists = prices.find(price => price.recurring)
  // if (!businessIdConnectedAccountId?.Business.connectAccountId) {
  //   console.log('Business is not connected')
  //   return NextResponse.json({ error: 'Business account is not connected' })
  // }

  try {
    // Attribution the webhook reads off `checkout.session.completed` to record
    // a Payment ledger row against the right sub-account (and funnel). Amounts
    // are always taken from Stripe in the webhook, never from the client.
    const attribution = {
      source: 'FUNNEL',
      subAccountId: subaccountId,
      ...(funnelId ? { funnelId } : {}),
    }

    const session = await stripe.checkout.sessions.create(
      {
        line_items: prices.map(price => ({
          price: price.productId,
          quantity: 1,
        })),

        // Session-level metadata is what `checkout.session.completed` carries.
        metadata: attribution,

        ...(subscriptionPriceExists && {
          subscription_data: {
            metadata: { connectAccountSubscriptions: 'true', ...attribution },
            application_fee_percent:
              +process.env.NEXT_PUBLIC_PLATFORM_SUBSCRIPTION_PERCENT,
          },
        }),

        ...(!subscriptionPriceExists && {
          payment_intent_data: {
            metadata: { connectAccountPayments: 'true', ...attribution },
            application_fee_amount:
              +process.env.NEXT_PUBLIC_PLATFORM_ONETIME_FEE * 100,
          },
        }),

        mode: subscriptionPriceExists ? 'subscription' : 'payment',
        ui_mode: 'embedded',
        redirect_on_completion: 'never',
      },
      { stripeAccount: subAccountConnectAccId }
    )

    return NextResponse.json(
      {
        clientSecret: session.client_secret,
      },
      {
        headers: {
          'Access-Control-Allow-Origin': origin || '*',
          'Access-Control-Allow-Methods': 'GET,OPTIONS,PATCH,DELETE,POST,PUT',
          'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        },
      }
    )
  } catch (error) {
    console.log('🔴 Error', error)
    //@ts-ignore
    return NextResponse.json({ error: error.message })
  }
}

export async function OPTIONS(request: Request) {
  const allowedOrigin = request.headers.get('origin')
  const response = new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': allowedOrigin || '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers':
        'Content-Type, Authorization, X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Date, X-Api-Version',
      'Access-Control-Max-Age': '86400',
    },
  })

  return response
}
