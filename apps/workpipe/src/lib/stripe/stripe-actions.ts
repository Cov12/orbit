'use server'

import { stripe } from '.'

/**
 * Stripe Connect Actions — WorkPipe
 *
 * Platform subscription management has moved to Orbit Portal.
 * These actions support subaccount Stripe Connect (rebilling/white-label).
 */

/**
 * Get products from a connected Stripe account (subaccount).
 * Used by funnel editor checkout to list available products.
 */
export const getConnectAccountProducts = async (stripeAccount: string) => {
  const products = await stripe.products.list(
    {
      limit: 50,
      expand: ['data.default_price'],
    },
    {
      stripeAccount,
    }
  )
  return products.data
}
