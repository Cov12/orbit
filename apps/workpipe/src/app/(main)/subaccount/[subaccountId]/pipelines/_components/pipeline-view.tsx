'use client'
import { useEffect, useMemo, useState } from 'react'

import { Ticket } from '@prisma/client'
import { Flag, Plus } from 'lucide-react'
import { useRouter } from 'next/navigation'

import LaneForm from '@/components/forms/lane-form'
import TicketForm from '@/components/forms/ticket-form'
import CustomModal from '@/components/global/custom-modal'
import { Button } from '@/components/ui/button'
import {
  KanbanBoard,
  KanbanCard,
  KanbanCards,
  KanbanHeader,
  KanbanProvider,
} from '@/components/ui/shadcn-io/kanban'
import {
  PipelineDetailsWithLanesCardsTagsTickets,
  SerializedLane,
  SerializedTicket,
  TicketWithTags,
} from '@/lib/types'
import { useModal } from '@/providers/modal-provider'

import PipelineTicketCard from './pipeline-ticket-card'

type Props = {
  lanes: SerializedLane[]
  pipelineId: string
  subaccountId: string
  pipelineDetails: PipelineDetailsWithLanesCardsTagsTickets
  updateTicketsOrder: (tickets: Ticket[]) => Promise<void>
}

type KanbanTicket = SerializedTicket & {
  column: string
}

const PipelineView = ({
  lanes,
  pipelineDetails,
  pipelineId,
  subaccountId,
  updateTicketsOrder,
}: Props) => {
  const { setOpen } = useModal()
  const router = useRouter()

  // Generate random color for each lane (memoized by lane id)
  const laneColors = useMemo(() => {
    const colors: Record<string, string> = {}
    lanes.forEach(lane => {
      colors[lane.id] = `#${Math.random().toString(16).slice(2, 8)}`
    })
    return colors
  }, [lanes])

  // Transform lanes into kanban columns format
  const columns = useMemo(
    () =>
      lanes.map(lane => ({
        id: lane.id,
        name: lane.name,
        color: laneColors[lane.id],
        order: lane.order,
      })),
    [lanes, laneColors]
  )

  // Transform tickets into kanban data format
  const initialTickets: KanbanTicket[] = useMemo(() => {
    const tickets: KanbanTicket[] = []
    lanes.forEach(lane => {
      lane.Tickets.forEach(ticket => {
        tickets.push({
          ...ticket,
          column: lane.id,
        })
      })
    })
    return tickets
  }, [lanes])

  const [tickets, setTickets] = useState<KanbanTicket[]>(initialTickets)

  useEffect(() => {
    setTickets(initialTickets)
  }, [initialTickets])

  const handleAddLane = () => {
    setOpen(
      <CustomModal
        title="Create A Lane"
        subheading="Lanes allow you to group tickets"
      >
        <LaneForm pipelineId={pipelineId} />
      </CustomModal>
    )
  }

  const handleAddTicket = (laneId: string) => {
    setOpen(
      <CustomModal title="Create A Ticket" subheading="">
        <TicketForm
          getNewTicket={(ticket: TicketWithTags[0]) => {
            // Ticket value is already serialized from server action
            const serializedTicket = ticket as SerializedTicket
            // Add the new ticket to state
            setTickets(prev => [
              ...prev,
              { ...serializedTicket, column: laneId },
            ])
            router.refresh()
          }}
          laneId={laneId}
          subaccountId={subaccountId}
        />
      </CustomModal>
    )
  }

  const handleDataChange = async (newData: KanbanTicket[]) => {
    setTickets(newData)

    // Update tickets that changed lanes
    const ticketsToUpdate = newData.filter((ticket, index) => {
      const oldTicket = tickets[index]
      return oldTicket && ticket.column !== oldTicket.column
    })

    if (ticketsToUpdate.length > 0) {
      // Map the tickets back to the database format
      const updatedTickets = ticketsToUpdate.map((ticket, idx) => ({
        ...ticket,
        laneId: ticket.column,
        order: idx,
      }))

      await updateTicketsOrder(updatedTickets as Ticket[])
      router.refresh()
    }
  }

  const handleTicketUpdate = (updatedTicket: SerializedTicket) => {
    setTickets(prevTickets =>
      prevTickets.map(ticket =>
        ticket.id === updatedTicket.id
          ? { ...updatedTicket, column: updatedTicket.laneId }
          : ticket
      )
    )
  }

  const handleTicketDelete = (ticketId: string) => {
    setTickets(prevTickets =>
      prevTickets.filter(ticket => ticket.id !== ticketId)
    )
  }

  const amt = new Intl.NumberFormat(undefined, {
    style: 'currency',
    currency: 'USD',
  })

  return (
    <div className="use-automation-zoom-in overflow-y-hidden rounded-xl bg-white/60 p-4 dark:bg-background/60">
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-2xl">{pipelineDetails?.name}</h1>
        <Button className="flex items-center gap-4" onClick={handleAddLane}>
          <Plus size={15} />
          Create Lane
        </Button>
      </div>

      {columns.length === 0 ? (
        <div className="flex w-full flex-col items-center justify-center">
          <div className="opacity-100">
            <Flag
              width="100%"
              height="100%"
              className="text-muted-foreground"
            />
          </div>
        </div>
      ) : (
        <KanbanProvider
          columns={columns}
          data={tickets}
          onDataChange={handleDataChange}
        >
          {column => (
            <KanbanBoard id={column.id} key={column.id} className="group">
              <KanbanHeader>
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <div
                      className="h-2 w-2 rounded-full"
                      style={{ backgroundColor: column.color }}
                    />
                    <span>{column.name}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="rounded bg-white px-2 py-0.5 text-xs text-black dark:bg-slate-800 dark:text-white">
                      {amt.format(
                        tickets
                          .filter(t => t.column === column.id)
                          .reduce((sum, t) => sum + (Number(t.value) || 0), 0)
                      )}
                    </div>
                    <button
                      onClick={() => handleAddTicket(column.id)}
                      className="flex h-5 w-5 items-center justify-center rounded opacity-0 transition-opacity hover:bg-muted group-hover:opacity-100"
                      type="button"
                      title="Add ticket"
                    >
                      <Plus className="h-3 w-3 text-muted-foreground" />
                    </button>
                  </div>
                </div>
              </KanbanHeader>
              <KanbanCards id={column.id}>
                {(ticket: KanbanTicket) => (
                  <KanbanCard
                    column={column.id}
                    id={ticket.id}
                    key={ticket.id}
                    name={ticket.name}
                    className="group"
                  >
                    <PipelineTicketCard
                      ticket={ticket}
                      subaccountId={subaccountId}
                      onUpdate={handleTicketUpdate}
                      onDelete={handleTicketDelete}
                    />
                  </KanbanCard>
                )}
              </KanbanCards>
            </KanbanBoard>
          )}
        </KanbanProvider>
      )}
    </div>
  )
}

export default PipelineView
