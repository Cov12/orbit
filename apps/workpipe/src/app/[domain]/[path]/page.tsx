import React from 'react'

import { notFound } from 'next/navigation'

import FunnelEditor from '@/app/(main)/subaccount/[subaccountId]/funnels/[funnelId]/editor/[funnelPageId]/_components/funnel-editor'
import { db } from '@/lib/db'
import { ensureFunnelLeadForm } from '@/lib/lead-form'
import { getDomainContent } from '@/lib/queries'
import EditorProvider from '@/providers/editor/editor-provider'

const Page = async ({
  params,
}: {
  params: Promise<{ domain: string; path: string }>
}) => {
  const { domain, path } = await params
  // The middleware rewrites `<subdomain>.<root>` into a `domain` param that
  // carries a trailing dot (e.g. "mysite."). Strip a trailing dot if present
  // rather than blindly dropping the last character.
  const domainData = await getDomainContent(domain.replace(/\.$/, ''))
  const pageData = domainData?.FunnelPages.find(page => page.pathName === path)

  if (!pageData || !domainData) return notFound()

  // Count the visit — mirrors the root funnel page so sub-page analytics
  // aren't silently undercounted.
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

  // Mint (once) the public form key this funnel's contact form posts to.
  // Null when provisioning fails — the form then falls back to the legacy path.
  const leadFormKey = await ensureFunnelLeadForm({
    id: domainData.id,
    subAccountId: domainData.subAccountId,
    name: domainData.name,
  })

  return (
    <EditorProvider
      subaccountId={domainData.subAccountId}
      pageDetails={pageData}
      funnelId={domainData.id}
      leadFormKey={leadFormKey}
    >
      <FunnelEditor funnelPageId={pageData.id} liveMode={true} />
    </EditorProvider>
  )
}

export default Page
