import { CheckCircleIcon } from 'lucide-react'
import Image from 'next/image'
import Link from 'next/link'

import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { db } from '@/lib/db'
import { stripe } from '@/lib/stripe'
import { getStripeOAuthLink } from '@/lib/utils'

type Props = {
  params: Promise<{
    businessId: string
  }>
  searchParams: Promise<{ code: string }>
}

const LaunchPadPage = async ({ params, searchParams }: Props) => {
  const { businessId } = await params
  const { code } = await searchParams
  const businessDetails = await db.business.findUnique({
    where: { id: businessId },
  })

  if (!businessDetails) return

  const allDetailsExist =
    businessDetails.address &&
    businessDetails.address &&
    businessDetails.businessLogo &&
    businessDetails.city &&
    businessDetails.companyEmail &&
    businessDetails.companyPhone &&
    businessDetails.country &&
    businessDetails.name &&
    businessDetails.state &&
    businessDetails.zipCode

  const stripeOAuthLink = getStripeOAuthLink(
    'business',
    `kickstart___${businessDetails.id}`
  )

  //cleanup
  // const stripeOAuthLink = `kickstart___${businessDetails.id}`

  let connectedStripeAccount = false

  if (code) {
    if (!businessDetails.connectAccountId) {
      try {
        const response = await stripe.oauth.token({
          grant_type: 'authorization_code',
          code: code,
        })
        await db.business.update({
          where: { id: businessId },
          data: { connectAccountId: response.stripe_user_id },
        })
        connectedStripeAccount = true
      } catch (error) {
        console.log('🔴 Could not connect stripe account')
      }
    }
  }

  return (
    <div className="flex flex-col items-center justify-center">
      <div className="h-full w-full max-w-[800px]">
        <Card className="border-none">
          <CardHeader>
            <CardTitle>Lets get started!</CardTitle>
            <CardDescription>
              Follow the steps below to get your account setup.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <div className="flex w-full items-center justify-between gap-2 rounded-lg border p-4">
              <div className="flex flex-col gap-4 md:!flex-row md:items-center">
                <Image
                  src="/appstore.png"
                  alt="app logo"
                  height={80}
                  width={80}
                  className="rounded-md object-contain"
                />
                <p> Save the website as a shortcut on your mobile device</p>
              </div>
              <Button>Start</Button>
            </div>
            <div className="flex w-full items-center justify-between gap-2 rounded-lg border p-4">
              <div className="flex flex-col gap-4 md:!flex-row md:items-center">
                <Image
                  src="/stripelogo.png"
                  alt="app logo"
                  height={80}
                  width={80}
                  className="rounded-md object-contain"
                />
                <p>
                  Connect your stripe account to accept payments and see your
                  dashboard.
                </p>
              </div>
              {businessDetails.connectAccountId || connectedStripeAccount ? (
                <CheckCircleIcon
                  size={50}
                  className="flex-shrink-0 p-2 text-primary"
                />
              ) : (
                <Link
                  className="rounded-md bg-primary px-4 py-2 text-white"
                  href={stripeOAuthLink}
                >
                  Start
                </Link>
              )}
            </div>
            <div className="flex w-full items-center justify-between gap-2 rounded-lg border p-4">
              <div className="flex flex-col gap-4 md:!flex-row md:items-center">
                <Image
                  src={businessDetails.businessLogo}
                  alt="app logo"
                  height={80}
                  width={80}
                  className="rounded-md object-contain"
                />
                <p> Fill in all your bussiness details</p>
              </div>
              {allDetailsExist ? (
                <CheckCircleIcon
                  size={50}
                  className="flex-shrink-0 p-2 text-primary"
                />
              ) : (
                <Link
                  className="rounded-md bg-primary px-4 py-2 text-white"
                  href={`/business/${businessId}/settings`}
                >
                  Start
                </Link>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

export default LaunchPadPage
