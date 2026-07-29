import React from 'react'

import { Role } from '@prisma/client'
import { redirect } from 'next/navigation'

import InfoBar from '@/components/global/infobar'
import Sidebar from '@/components/sidebar'
import Unauthorized from '@/components/unauthorized'
import { requireAuth } from '@/lib/auth'
import {
  ensureInvoicesSidebarOption,
  getAuthUserDetails,
  getNotificationAndUser,
  verifyAndAcceptInvitation,
} from '@/lib/queries'

// Force dynamic rendering to support Clerk's headers access in Next.js 15
export const dynamic = 'force-dynamic'

type Props = {
  children: React.ReactNode
  params: Promise<{ subaccountId: string }>
}

const SubaccountLayout = async ({ children, params }: Props) => {
  const { subaccountId } = await params
  const businessId = await verifyAndAcceptInvitation()
  if (!businessId) return <Unauthorized />

  // Back-fill the Invoices nav link for sub-accounts provisioned before it
  // existed. Idempotent + non-blocking; runs before the sidebar reads its rows.
  await ensureInvoicesSidebarOption(subaccountId)
  const user = await requireAuth().catch(() => null)
  if (!user) {
    return redirect('/')
  }

  let notifications: any = []
  let allPermissions
  try {
    allPermissions = await getAuthUserDetails()
  } catch (error) {
    console.error('Error fetching auth details:', error)
    return <Unauthorized />
  }

  if (!allPermissions?.role) {
    return <Unauthorized />
  } else {
    const hasPermission = allPermissions?.Permissions.find(
      permissions =>
        permissions.access && permissions.subAccountId === subaccountId
    )
    if (!hasPermission) {
      return <Unauthorized />
    }

    try {
      const allNotifications = await getNotificationAndUser(businessId)

      if (
        allPermissions.role === 'BUSINESS_ADMIN' ||
        allPermissions.role === 'BUSINESS_OWNER'
      ) {
        notifications = allNotifications
      } else {
        const filteredNoti = allNotifications?.filter(
          item => item.subAccountId === subaccountId
        )
        if (filteredNoti) notifications = filteredNoti
      }
    } catch (error) {
      console.error('Error fetching notifications:', error)
      // Continue with empty notifications
    }
  }

  return (
    <div className="h-screen overflow-hidden">
      <Sidebar id={subaccountId} type="subaccount" />

      <div className="md:pl-[300px]">
        <InfoBar
          notifications={notifications}
          role={allPermissions.role as Role}
          subAccountId={subaccountId as string}
        />
        <div className="relative">{children}</div>
      </div>
    </div>
  )
}

export default SubaccountLayout
