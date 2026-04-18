import { headers } from 'next/headers'
import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'

import { stripe } from '@/lib/stripe'

/**
 * Stripe Webhook — WorkPipe
 *
 * Platform subscriptions (WorkPipe/Atrium plan billing) are now
 * handled by Orbit Portal. This webhook only processes events from
 * Stripe Connect (subaccount rebilling).
 */

const connectEvents = new Set(['checkout.session.completed', 'account.updated'])

export async function POST(req: NextRequest) {
  let stripeEvent: Stripe.Event
  const body = await req.text()
  const headersList = await headers()
  const sig = headersList.get('Stripe-Signature')
  const webhookSecret =
    process.env.STRIPE_WEBHOOK_SECRET_LIVE ?? process.env.STRIPE_WEBHOOK_SECRET

  try {
    if (!sig || !webhookSecret) {
      console.log(
        '🔴 Error Stripe webhook secret or the signature does not exist.'
      )
      return new NextResponse('Missing signature or secret', { status: 400 })
    }
    stripeEvent = stripe.webhooks.constructEvent(body, sig, webhookSecret)
  } catch (error: any) {
    console.log(`🔴 Error ${error.message}`)
    return new NextResponse(`Webhook Error: ${error.message}`, { status: 400 })
  }

  try {
    if (connectEvents.has(stripeEvent.type)) {
      const obj = stripeEvent.data.object as any

      // Only process Connect events (has connectAccount metadata)
      if (
        obj.metadata?.connectAccountPayments ||
        obj.metadata?.connectAccountSubscriptions
      ) {
        console.log(`[Stripe Connect Webhook] ${stripeEvent.type}`, obj.id)
        // TODO: Handle Connect checkout completion, account updates, etc.
      }
    }
  } catch (error) {
    console.log('🔴 Webhook processing error:', error)
    return new NextResponse('Webhook Error', { status: 400 })
  }

  return NextResponse.json({ webhookActionReceived: true }, { status: 200 })
}
