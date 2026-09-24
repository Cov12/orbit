import { getAuthUserDetails } from '@/lib/queries'

import MenuOptions from './menu-options'

type Props = {
  id: string
  type: 'business' | 'subaccount'
}

const Sidebar = async ({ id, type }: Props) => {
  const user = await getAuthUserDetails()
  if (!user) return null

  if (!user.Business) return

  const details =
    type === 'business'
      ? user?.Business
      : user?.Business.SubAccount.find((subaccount) => subaccount.id === id)

  const isWhiteLabeledBusiness = user.Business.whiteLabel
  if (!details) return

  let sideBarLogo = user.Business.businessLogo || ''

  if (!isWhiteLabeledBusiness) {
    if (type === 'subaccount') {
      sideBarLogo =
        user?.Business.SubAccount.find((subaccount) => subaccount.id === id)
          ?.subAccountLogo || user.Business.businessLogo
    }
  }

  const sidebarOpt =
    type === 'business'
      ? user.Business.SidebarOption || []
      : user.Business.SubAccount.find((subaccount) => subaccount.id === id)
          ?.SidebarOption || []

  const subaccounts = user.Business.SubAccount.filter((subaccount) =>
    user.Permissions.find(
      (permission) =>
        permission.subAccountId === subaccount.id && permission.access
    )
  )

  return (
    <>
      <MenuOptions
        defaultOpen={true}
        details={details}
        id={id}
        sidebarLogo={sideBarLogo}
        sidebarOpt={sidebarOpt}
        subAccounts={subaccounts}
        user={user}
      />
      <MenuOptions
        details={details}
        id={id}
        sidebarLogo={sideBarLogo}
        sidebarOpt={sidebarOpt}
        subAccounts={subaccounts}
        user={user}
      />
    </>
  )
}

export default Sidebar
