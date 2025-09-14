import BusinessDetails from '@/components/forms/business-details'
import UserDetails from '@/components/forms/user-details'
import { db } from '@/lib/db'
import { currentUser } from '@clerk/nextjs'

type Props = {
  params: { businessId: string }
}

const SettingsPage = async ({ params }: Props) => {
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
      id: params.businessId,
    },
    include: {
      SubAccount: true,
    },
  })

  if (!businessDetails) return null

  const subAccounts = businessDetails.SubAccount

  return (
    <div className="flex lg:!flex-row flex-col gap-4">
      <BusinessDetails data={businessDetails} />
      <UserDetails
        type="business"
        id={params.businessId}
        subAccounts={subAccounts}
        userData={userDetails}
      />
    </div>
  )
}

export default SettingsPage
