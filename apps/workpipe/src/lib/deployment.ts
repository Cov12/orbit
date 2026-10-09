// Deployment-level switches read on the server. Both are off unless explicitly set.

/** Shared demo workspace: block destructive actions that would break it for the next visitor. */
export const isDemoMode = () => process.env.WORKPIPE_DEMO_MODE === '1'

/** Stripe Connect needs a platform client ID; without one the connect links can't work. */
export const isStripeConnectConfigured = () =>
  Boolean(process.env.NEXT_PUBLIC_STRIPE_CLIENT_ID)
