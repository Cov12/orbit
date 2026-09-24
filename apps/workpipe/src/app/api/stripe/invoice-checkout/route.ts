import { NextResponse } from 'next/server'

import { getInvoiceByLink } from '@/lib/queries'
import { stripe } from '@/lib/stripe'

/**
 * POST /api/stripe/invoice-checkout  { token }
 *
 * Starts a Stripe Connect hosted checkout for a public invoice pay-link. The
 * amount is read from the invoice in the DB (never the client), on the
 * sub-account's connected account. The checkout metadata (source=INVOICE +
 * subAccountId + invoiceId) is what the existing webhook uses to record the
 * Payment and flip the invoice to PAID.
 */
export async function POST(req: Request) {
  try {
    const { token } = await req.json()
    if (!token) {
      return NextResponse.json({ error: 'Missing token' }, { status: 400 })
    }

    const invoice = await getInvoiceByLink(token)
    if (!invoice) {
      return NextResponse.json({ error: 'Invoice not found' }, { status: 404 })
    }
    if (invoice.status === 'PAID') {
      return NextResponse.json(
        { error: 'This invoice is already paid' },
        { status: 409 }
      )
    }
    if (invoice.totalDueCents <= 0) {
      return NextResponse.json({ error: 'Nothing to pay' }, { status: 400 })
    }

    const connectAccountId = invoice.Subaccount?.connectAccountId
    if (!connectAccountId) {
      return NextResponse.json(
        { error: 'Online payment is not available for this invoice' },
        { status: 400 }
      )
    }

    const origin =
      req.headers.get('origin') ||
      process.env.NEXT_PUBLIC_URL?.replace(/\/$/, '') ||
      ''
    const returnBase = `${origin}/invoice/${token}`

    // Attribution the webhook reads to record the Payment + mark the invoice PAID.
    const metadata = {
      source: 'INVOICE',
      subAccountId: invoice.subAccountId,
      invoiceId: invoice.id,
    }

    const session = await stripe.checkout.sessions.create(
      {
        mode: 'payment',
        line_items: [
          {
            price_data: {
              currency: invoice.currency || 'usd',
              product_data: { name: invoice.name || 'Invoice' },
              unit_amount: invoice.totalDueCents,
            },
            quantity: 1,
          },
        ],
        payment_intent_data: {
          metadata: { connectAccountPayments: 'true', ...metadata },
          // Platform fee is OPT-IN: only taken if explicitly configured, so we
          // don't quietly skim a sub-account's invoice payment by default.
          ...(process.env.NEXT_PUBLIC_PLATFORM_INVOICE_FEE
            ? {
                application_fee_amount: Math.round(
                  +process.env.NEXT_PUBLIC_PLATFORM_INVOICE_FEE * 100
                ),
              }
            : {}),
        },
        metadata,
        success_url: `${returnBase}?paid=1`,
        cancel_url: returnBase,
      },
      { stripeAccount: connectAccountId }
    )

    return NextResponse.json({ url: session.url })
  } catch (error) {
    console.error(
      '[invoice-checkout] error:',
      error instanceof Error ? error.message : error
    )
    return NextResponse.json(
      { error: 'Could not start checkout' },
      { status: 500 }
    )
  }
}
