import React from 'react'

import { redirect } from 'next/navigation'

import BlurPage from '@/components/global/blur-page'
import InfoBar from '@/components/global/infobar'
import Sidebar from '@/components/sidebar'
import Unauthorized from '@/components/unauthorized'
import { getAuthContext, requireAuth } from '@/lib/auth'
import { ForbiddenError } from '@/lib/authz'
import {
  getAuthUserDetails,
  getNotificationAndUser,
  verifyAndAcceptInvitation,
} from '@/lib/queries'
import { syncSubAccountsFromPortal } from '@/lib/subaccount-sync'

// Force dynamic rendering to support Clerk's headers access in Next.js 15
export const dynamic = 'force-dynamic'

type Props = {
  children: React.ReactNode
  params: Promise<{ businessId: string }>
}

const layout = async ({ children, params }: Props) => {
  const { businessId: businessIdParam } = await params
  const businessId = await verifyAndAcceptInvitation()
  const user = await requireAuth().catch(() => null)
  // Re-pull Portal sub-accounts before reading the user's business, so ones
  // created in Portal after this session started show up in the Sidebar
  // switcher (which renders off `userDetails`) without clearing the cookie.
  // Throttled + deduped, so this is a no-op on most loads.
  await syncSubAccountsFromPortal()
  const userDetails = await getAuthUserDetails()

  if (!user) {
    return redirect('/')
  }

  if (!businessId) {
    return redirect('/business')
  }

  if (
    userDetails?.role !== 'BUSINESS_OWNER' &&
    userDetails?.role !== 'BUSINESS_ADMIN'
  )
    return <Unauthorized />

  let allNoti: any = []
  try {
    const notifications = await getNotificationAndUser(businessId)
    if (notifications) allNoti = notifications
  } catch (error) {
    // `getNotificationAndUser` runs `assertOwnsBusiness`, which throws when the
    // session's org differs from the business this page resolved to (a stale
    // link, or a workspace just switched in Portal). That's an expected state,
    // not a crash — handle it here, server-side, where the error is still
    // typed. Next.js scrubs error messages in production, so a client
    // `error.tsx` could never tell this case apart from a real bug.
    // `instanceof` plus the `name` discriminant so bundling can't defeat it.
    const isForbidden =
      error instanceof ForbiddenError ||
      (error as Error | null)?.name === 'ForbiddenError'
    if (!isForbidden) throw error

    // Send them to their own active business — but only when that actually
    // moves them somewhere else, otherwise we'd redirect to this same URL and
    // loop.
    const { orgId } = await getAuthContext()
    if (orgId && orgId !== businessIdParam) {
      return redirect(`/business/${orgId}`)
    }
    return <Unauthorized />
  }

  return (
    <div className="h-screen overflow-hidden">
      <Sidebar id={businessIdParam} type="business" />
      <div className="md:pl-[300px]">
        <InfoBar notifications={allNoti} role={allNoti.User?.role} />
        <div className="relative">
          <BlurPage>{children}</BlurPage>
        </div>
      </div>
    </div>
  )
}

export default layout
