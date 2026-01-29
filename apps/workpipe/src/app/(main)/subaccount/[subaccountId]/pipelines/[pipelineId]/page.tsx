import { redirect } from 'next/navigation'

import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { db } from '@/lib/db'
import {
  getLanesWithTicketAndTags,
  getPipelineDetails,
  updateTicketsOrder,
} from '@/lib/queries'
import { LaneDetail, SerializedLane } from '@/lib/types'

import PipelineInfoBar from '../_components/pipeline-infobar'
import PipelineSettings from '../_components/pipeline-settings'
import PipelineView from '../_components/pipeline-view'

type Props = {
  params: Promise<{ subaccountId: string; pipelineId: string }>
}

const PipelinePage = async ({ params }: Props) => {
  const { subaccountId, pipelineId } = await params
  const pipelineDetails = await getPipelineDetails(pipelineId)
  if (!pipelineDetails) return redirect(`/subaccount/${subaccountId}/pipelines`)

  const pipelines = await db.pipeline.findMany({
    where: { subAccountId: subaccountId },
  })

  const lanes = (await getLanesWithTicketAndTags(pipelineId)) as LaneDetail[]

  // Convert Decimal values to numbers for client component serialization
  const serializedLanes: SerializedLane[] = lanes.map(lane => ({
    ...lane,
    Tickets: lane.Tickets.map(ticket => ({
      ...ticket,
      value: ticket.value?.toNumber() ?? null,
    })),
  }))

  return (
    <Tabs defaultValue="view" className="w-full">
      <TabsList className="mb-4 h-16 w-full justify-between border-b-2 bg-transparent">
        <PipelineInfoBar
          pipelineId={pipelineId}
          subAccountId={subaccountId}
          pipelines={pipelines}
        />
        <div>
          <TabsTrigger value="view">Pipeline View</TabsTrigger>
          <TabsTrigger value="settings">Settings</TabsTrigger>
        </div>
      </TabsList>
      <TabsContent value="view">
        <PipelineView
          lanes={serializedLanes}
          pipelineDetails={pipelineDetails}
          pipelineId={pipelineId}
          subaccountId={subaccountId}
          updateTicketsOrder={updateTicketsOrder}
        />
      </TabsContent>
      <TabsContent value="settings">
        <PipelineSettings
          pipelineId={pipelineId}
          pipelines={pipelines}
          subaccountId={subaccountId}
        />
      </TabsContent>
    </Tabs>
  )
}

export default PipelinePage
