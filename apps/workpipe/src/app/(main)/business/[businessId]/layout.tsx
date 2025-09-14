import BlurPage from '@/components/global/blur-page'
import InfoBar from '@/components/global/infobar'
import Sidebar from '@/components/sidebar'
import Unauthorized from '@/components/unauthorized'
import {
  getNotificationAndUser,
  verifyAndAcceptInvitation,
} from '@/lib/queries'
import { currentUser } from '@clerk/nextjs'
import { redirect } from 'next/navigation'
import React from 'react'

type Props = {
  children: React.ReactNode
  params: { businessId: string }
}

const layout = async ({ children, params }: Props) => {
  const businessId = await verifyAndAcceptInvitation()
  const user = await currentUser()

  if (!user) {
    return redirect('/')
  }

  if (!businessId) {
    return redirect('/business')
  }

  if (
    user.privateMetadata.role !== 'BUSINESS_OWNER' &&
    user.privateMetadata.role !== 'BUSINESS_ADMIN'
  )
    return <Unauthorized />

  let allNoti: any = []
  const notifications = await getNotificationAndUser(businessId)
  if (notifications) allNoti = notifications

 

  return (
    <div className="h-screen overflow-hidden">
      <Sidebar
        id={params.businessId}
        type="business"
      />
      <div className="md:pl-[300px]">
        <InfoBar
          notifications={allNoti}
          role={allNoti.User?.role}
        />
        <div className="relative">
          <BlurPage>{children}</BlurPage>
        </div>
      </div>
    </div>
  )
}

export default layout
