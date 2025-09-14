// app/api/stripe/webhook/route.ts
import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'
import { headers } from 'next/headers'
import { PrismaClient } from '@prisma/client'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY as string, {
  apiVersion: '2024-06-20',
})

const prisma = new PrismaClient()

export const config = {
  api: { bodyParser: false },
}

// Utility: parse raw body for Stripe signature verification
async function getRawBody(req: NextRequest): Promise<Buffer> {
  const arrayBuffer = await req.arrayBuffer()
  return Buffer.from(arrayBuffer)
}

export async function POST(req: NextRequest) {
  const sig = (await headers()).get('stripe-signature') as string
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET as string

  let event: Stripe.Event

  try {
    const rawBody = await getRawBody(req)
    event = stripe.webhooks.constructEvent(rawBody, sig, webhookSecret)
  } catch (err: any) {
    console.error('❌ Webhook signature verification failed.', err?.message)
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 })
  }

  try {
    switch (event.type) {
      case 'invoice.finalized':
      case 'invoice.paid':
      case 'invoice.payment_failed': {
        const invoice = event.data.object as Stripe.Invoice

        // Resolve Business by Stripe customer ID
        const stripeCustomerId = invoice.customer as string | null
        if (!stripeCustomerId) break

        const business = await prisma.business.findFirst({
          where: { stripeCustomerId },
          select: { id: true },
        })
        if (!business) {
          console.warn('Invoice received for unknown business', stripeCustomerId)
          break
        }

        const amountDue = invoice.amount_due ?? 0
        const amountPaid = invoice.amount_paid ?? 0
        const pdf = typeof invoice.invoice_pdf === 'string' ? invoice.invoice_pdf : null
        const periodStart = new Date((invoice.lines?.data?.[0]?.period?.start ?? invoice.created) * 1000)
        const periodEnd = new Date((invoice.lines?.data?.[0]?.period?.end ?? invoice.created) * 1000)

        await prisma.invoice.upsert({
          where: { stripeInvoiceId: invoice.id },
          update: {
            businessId: business.id,
            amountDue,
            amountPaid,
            currency: invoice.currency ?? 'usd',
            status: invoice.status ?? 'open',
            pdfUrl: pdf ?? undefined,
            periodStart,
            periodEnd,
          },
          create: {
            stripeInvoiceId: invoice.id,
            businessId: business.id,
            amountDue,
            amountPaid,
            currency: invoice.currency ?? 'usd',
            status: invoice.status ?? 'open',
            pdfUrl: pdf ?? undefined,
            periodStart,
            periodEnd,
          },
        })
        break
      }

      case 'customer.subscription.updated': {
        // Optionally sync subscription tier/status on Business
        const sub = event.data.object as Stripe.Subscription
        const stripeCustomerId = sub.customer as string | null
        if (!stripeCustomerId) break

        const business = await prisma.business.findFirst({
          where: { stripeCustomerId },
          select: { id: true },
        })
        if (!business) break

        await prisma.subscription.updateMany({
          where: { businessId: business.id, stripeSubscriptionId: sub.id },
          data: { status: sub.status },
        })
        break
      }

      default:
        // Ignore other events for now
        break
    }

    return NextResponse.json({ received: true })
  } catch (err) {
    console.error('⚠️ Webhook handler error', err)
    return NextResponse.json({ error: 'Webhook handler error' }, { status: 500 })
  }
}
