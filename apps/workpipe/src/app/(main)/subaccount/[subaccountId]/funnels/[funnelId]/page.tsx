import React, { Suspense } from 'react'

import Link from 'next/link'
import { redirect } from 'next/navigation'

import BlurPage from '@/components/global/blur-page'
import Loading from '@/components/global/loading'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { getFunnel } from '@/lib/queries'

import FunnelSettings from './_components/funnel-settings'
import FunnelSteps from './_components/funnel-steps'

type Props = {
  params: Promise<{ funnelId: string; subaccountId: string }>
}

const FunnelPage = async ({ params }: Props) => {
  const { funnelId, subaccountId } = await params

  let funnelPages
  try {
    funnelPages = await getFunnel(funnelId)
  } catch (error) {
    console.error('Error fetching funnel:', error)
    return redirect(`/subaccount/${subaccountId}/funnels`)
  }

  if (!funnelPages) return redirect(`/subaccount/${subaccountId}/funnels`)

  return (
    <BlurPage>
      <Link
        href={`/subaccount/${subaccountId}/funnels`}
        className="mb-4 flex justify-between gap-4 text-muted-foreground"
      >
        Back
      </Link>
      <h1 className="mb-8 text-3xl">{funnelPages.name}</h1>
      <Tabs defaultValue="steps" className="w-full">
        <TabsList className="grid w-[50%] grid-cols-2 bg-transparent">
          <TabsTrigger value="steps">Steps</TabsTrigger>
          <TabsTrigger value="settings">Settings</TabsTrigger>
        </TabsList>
        <TabsContent value="steps">
          <FunnelSteps
            funnel={funnelPages}
            subaccountId={subaccountId}
            pages={funnelPages.FunnelPages}
            funnelId={funnelId}
          />
        </TabsContent>
        <TabsContent value="settings">
          <Suspense fallback={<Loading />}>
            <FunnelSettings
              subaccountId={subaccountId}
              defaultData={funnelPages}
            />
          </Suspense>
        </TabsContent>
      </Tabs>
    </BlurPage>
  )
}

export default FunnelPage
