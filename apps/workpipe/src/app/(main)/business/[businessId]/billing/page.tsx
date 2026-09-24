import { redirect } from 'next/navigation'

/**
 * Business billing now lives in Orbit Portal.
 * This page redirects to Portal's billing page.
 *
 * Rebilling (subaccount Stripe Connect) remains in WorkPipe.
 */
const BillingPage = () => {
  const portalUrl =
    process.env.NEXT_PUBLIC_PORTAL_URL || 'https://portal.orbit.example'
  return redirect(`${portalUrl}/billing`)
}

export default BillingPage
