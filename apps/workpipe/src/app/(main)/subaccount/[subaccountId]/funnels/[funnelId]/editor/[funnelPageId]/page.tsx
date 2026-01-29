import { redirect } from 'next/navigation'

import { db } from '@/lib/db'
import EditorProvider from '@/providers/editor/editor-provider'

import FunnelEditor from './_components/funnel-editor'
import FunnelEditorNavigation from './_components/funnel-editor-navigation'
import FunnelEditorSidebar from './_components/funnel-editor-sidebar'

type Props = {
  params: Promise<{
    subaccountId: string
    funnelId: string
    funnelPageId: string
  }>
}

const Page = async ({ params }: Props) => {
  const { subaccountId, funnelId, funnelPageId } = await params
  const funnelPageDetails = await db.funnelPage.findFirst({
    where: {
      id: funnelPageId,
    },
    include: {
      Funnel: true,
    },
  })
  if (!funnelPageDetails) {
    return redirect(`/subaccount/${subaccountId}/funnels/${funnelId}`)
  }

  return (
    <div className="fixed bottom-0 left-0 right-0 top-0 z-[20] overflow-hidden bg-background">
      <EditorProvider
        subaccountId={subaccountId}
        funnelId={funnelId}
        pageDetails={funnelPageDetails}
      >
        <FunnelEditorNavigation
          funnelId={funnelId}
          funnelPageDetails={funnelPageDetails}
          subaccountId={subaccountId}
        />
        <div className="flex h-full justify-center">
          <FunnelEditor funnelPageId={funnelPageId} />
        </div>

        <FunnelEditorSidebar subaccountId={subaccountId} />
      </EditorProvider>
    </div>
  )
}

export default Page
