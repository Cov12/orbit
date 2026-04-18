import { getPortalContext } from './auth'

/**
 * Plan Gating — WorkPipe
 *
 * Reads subscription status from Portal JWT to gate features.
 * No Stripe calls, no local DB lookups — Portal is source of truth.
 *
 * Usage:
 *   const plan = await getActivePlan('WORKPIPE')
 *   if (!plan) redirect to Portal billing
 *   if (plan === 'STARTER') limit features
 */

export type PlanTier =
  | 'FREE'
  | 'STARTER'
  | 'PRO'
  | 'BUSINESS'
  | 'GROWTH'
  | 'ENTERPRISE'

type SubscriptionInfo = {
  plan: string
  status: string
}

/**
 * Get the active plan tier for a specific app from the Portal JWT.
 * Returns null if no active subscription found for the given app.
 */
export const getActivePlan = async (
  app: 'WORKPIPE' | 'ATRIUM' = 'WORKPIPE'
): Promise<PlanTier | null> => {
  const ctx = await getPortalContext()
  if (!ctx) return null

  const subs = (ctx as any).subscriptions as SubscriptionInfo[] | undefined
  if (!subs?.length) return null

  const active = subs.find(
    s => s.status === 'ACTIVE' || s.status === 'TRIALING'
  )
  if (!active) return null

  return active.plan as PlanTier
}

/**
 * Check if a specific app is in the user's app_access list.
 */
export const hasAppAccess = async (
  app: 'WORKPIPE' | 'ATRIUM' | 'DRIVE'
): Promise<boolean> => {
  const ctx = await getPortalContext()
  if (!ctx) return false

  const apps = (ctx as any).app_access as string[] | undefined
  return apps?.includes(app) ?? false
}

/**
 * Plan hierarchy for comparison.
 * Higher index = more features.
 */
const PLAN_ORDER: PlanTier[] = [
  'FREE',
  'STARTER',
  'PRO',
  'BUSINESS',
  'GROWTH',
  'ENTERPRISE',
]

/**
 * Check if user's plan meets a minimum tier requirement.
 *
 * Usage:
 *   if (await meetsMinPlan('PRO')) { ... }
 */
export const meetsMinPlan = async (
  minPlan: PlanTier,
  app: 'WORKPIPE' | 'ATRIUM' = 'WORKPIPE'
): Promise<boolean> => {
  const current = await getActivePlan(app)
  if (!current) return false

  const currentIdx = PLAN_ORDER.indexOf(current)
  const minIdx = PLAN_ORDER.indexOf(minPlan)
  return currentIdx >= minIdx
}
