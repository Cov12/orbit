import { headers } from 'next/headers'
import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'

import { db } from '@/lib/db'
import { stripe } from '@/lib/stripe'

/**
 * Stripe Webhook — WorkPipe
 *
 * Platform subscriptions (WorkPipe/Atrium plan billing) are now
 * handled by Orbit Portal. This webhook only processes events from
 * Stripe Connect (subaccount rebilling) — funnel checkouts and, later,
 * invoice pay-links — recording each completed payment to the Payment ledger.
 */

/**
 * Record a completed Stripe Connect checkout to the Payment ledger.
 *
 * Attribution (subAccountId / funnelId / source) is read from the session
 * metadata stamped by create-checkout-session. The amount is taken from Stripe
 * (`amount_total`), never the client. Idempotent on stripeSessionId so Stripe
 * retries never double-count.
 */
async function recordPaymentFromSession(session: Stripe.Checkout.Session) {
  const meta = session.metadata ?? {}
  const subAccountId = meta.subAccountId
  // Not one of our attributed sales — ignore.
  if (!subAccountId) return

  const source = meta.source === 'INVOICE' ? 'INVOICE' : 'FUNNEL'
  const amountCents = session.amount_total
  if (amountCents == null) return

  const paymentIntentId =
    typeof session.payment_intent === 'string' ? session.payment_intent : null
  const customerEmail =
    session.customer_details?.email ?? session.customer_email ?? null

  await db.payment.upsert({
    where: { stripeSessionId: session.id },
    // Empty update = idempotent: a retried event never mutates an existing row.
    update: {},
    create: {
      subAccountId,
      amountCents,
      currency: session.currency ?? 'usd',
      source,
      status: 'PAID',
      stripeSessionId: session.id,
      stripePaymentIntentId: paymentIntentId,
      funnelId: meta.funnelId || null,
      invoiceId: meta.invoiceId || null,
      customerEmail,
    },
  })

  // Invoice pay-links (source=INVOICE) also flip the Invoice to PAID. Idempotent:
  // re-setting PAID on a retry is harmless. Scoped to the sub-account so a spoofed
  // invoiceId can't mark another tenant's invoice paid.
  if (source === 'INVOICE' && meta.invoiceId) {
    await db.invoice.updateMany({
      where: { id: meta.invoiceId, subAccountId },
      data: { status: 'PAID', paidAt: new Date() },
    })
  }
}

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
    if (stripeEvent.type === 'checkout.session.completed') {
      const session = stripeEvent.data.object as Stripe.Checkout.Session
      await recordPaymentFromSession(session)
    }
    // account.updated (Connect onboarding state) is not yet consumed.
  } catch (error) {
    console.log('🔴 Webhook processing error:', error)
    return new NextResponse('Webhook Error', { status: 400 })
  }

  return NextResponse.json({ webhookActionReceived: true }, { status: 200 })
}
