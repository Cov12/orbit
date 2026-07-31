import React from 'react'

import { notFound } from 'next/navigation'

import { db } from '@/lib/db'
import { getDomainContent } from '@/lib/queries'
import EditorProvider from '@/providers/editor/editor-provider'

import FunnelEditor from '../(main)/subaccount/[subaccountId]/funnels/[funnelId]/editor/[funnelPageId]/_components/funnel-editor'

const Page = async ({ params }: { params: Promise<{ domain: string }> }) => {
  const { domain } = await params
  // Strip a trailing dot if the middleware left one (e.g. "mysite.") rather
  // than blindly dropping the last character.
  const domainData = await getDomainContent(domain.replace(/\.$/, ''))
  if (!domainData) return notFound()

  const pageData = domainData.FunnelPages.find(page => !page.pathName)

  if (!pageData) return notFound()

  await db.funnelPage.update({
    where: {
      id: pageData.id,
    },
    data: {
      visits: {
        increment: 1,
      },
    },
  })

  return (
    <EditorProvider
      subaccountId={domainData.subAccountId}
      pageDetails={pageData}
      funnelId={domainData.id}
    >
      <FunnelEditor funnelPageId={pageData.id} liveMode={true} />
    </EditorProvider>
  )
}

export default Page
