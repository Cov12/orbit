import { currentUser } from '@clerk/nextjs'

import BusinessDetails from '@/components/forms/business-details'
import UserDetails from '@/components/forms/user-details'
import { db } from '@/lib/db'

// Force dynamic rendering to support Clerk's headers access in Next.js 15
export const dynamic = 'force-dynamic'

type Props = {
  params: Promise<{ businessId: string }>
}

const SettingsPage = async ({ params }: Props) => {
  const { businessId } = await params
  const authUser = await currentUser()
  if (!authUser) return null

  const userDetails = await db.user.findUnique({
    where: {
      email: authUser.emailAddresses[0].emailAddress,
    },
  })

  if (!userDetails) return null
  const businessDetails = await db.business.findUnique({
    where: {
      id: businessId,
    },
    include: {
      SubAccount: true,
    },
  })

  if (!businessDetails) return null

  const subAccounts = businessDetails.SubAccount

  return (
    <div className="flex flex-col gap-4 lg:!flex-row">
      <BusinessDetails data={businessDetails} />
      <UserDetails
        type="business"
        id={businessId}
        subAccounts={subAccounts}
        userData={userDetails}
      />
    </div>
  )
}

export default SettingsPage
