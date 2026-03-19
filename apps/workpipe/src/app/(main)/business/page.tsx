import React from 'react'

import { redirect } from 'next/navigation'

import BusinessDetails from '@/components/forms/business-details'
import { requireAuth } from '@/lib/auth'
import { getAuthUserDetails, verifyAndAcceptInvitation } from '@/lib/queries'

// Force dynamic rendering to support Clerk's headers access in Next.js 15
export const dynamic = 'force-dynamic'

const Page = async ({
  searchParams,
}: {
  searchParams: Promise<{ plan: string; state: string; code: string }>
}) => {
  const { plan, state, code } = await searchParams
  // cleanup
  let authUser
  try {
    authUser = await requireAuth()
  } catch {
    return redirect('/sign-in')
  }

  const businessId = await verifyAndAcceptInvitation()
  console.log('businessId: ', businessId)

  //get the users details
  const user = await getAuthUserDetails()

  //get business details
  if (businessId) {
    if (user?.role === 'SUBACCOUNT_GUEST' || user?.role === 'SUBACCOUNT_USER') {
      return redirect('/subaccount')
    } else if (
      user?.role === 'BUSINESS_OWNER' ||
      user?.role === 'BUSINESS_ADMIN'
    ) {
      // Removed auto-redirect to billing when plan param exists.
      // Users now go to their dashboard after signup and can set up billing when ready.
      if (state) {
        const statePath = state.split('___')[0]
        const stateBusinessId = state.split('___')[1]
        if (!stateBusinessId) return <div>Not authorized</div>
        return redirect(
          `/business/${stateBusinessId}/${statePath}?code=${code}`
        )
      } else return redirect(`/business/${businessId}`)
    } else {
      return <div>Not authorized</div>
    }
  }

  return (
    <div className="mt-4 flex items-center justify-center">
      <div className="max-w-[850px] rounded-xl border-[1px] p-4">
        <h1 className="text-4xl"> Business Onboarding</h1>
        <BusinessDetails data={{ companyEmail: authUser.email }} />
      </div>
    </div>
  )
}

export default Page
