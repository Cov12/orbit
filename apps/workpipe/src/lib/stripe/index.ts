import Stripe from 'stripe'

let _stripe: Stripe | null = null

export function getStripe(): Stripe {
  if (!_stripe) {
    _stripe = new Stripe(process.env.STRIPE_SECRET_KEY ?? '', {
      apiVersion: '2025-11-17.clover',
      appInfo: {
        name: 'WorkPipe',
        version: '0.1.0',
      },
    })
  }
  return _stripe
}

/** @deprecated Use getStripe() instead — lazy init prevents build-time crashes */
export const stripe = new Proxy({} as Stripe, {
  get(_, prop) {
    return (getStripe() as any)[prop]
  },
})
