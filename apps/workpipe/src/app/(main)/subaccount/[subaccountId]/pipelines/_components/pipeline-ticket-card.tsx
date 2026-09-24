'use client'
import { useState } from 'react'

import { Edit, MoreHorizontal, Trash } from 'lucide-react'
import { useRouter } from 'next/navigation'

import TicketForm from '@/components/forms/ticket-form'
import CustomModal from '@/components/global/custom-modal'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { toast } from '@/components/ui/use-toast'
import { deleteTicket, saveActivityLogsNotification } from '@/lib/queries'
import { SerializedTicket, TicketWithTags } from '@/lib/types'
import { useModal } from '@/providers/modal-provider'

type Props = {
  ticket: SerializedTicket
  subaccountId: string
  onUpdate: (ticket: SerializedTicket) => void
  onDelete: (ticketId: string) => void
}

const PipelineTicketCard = ({
  ticket,
  subaccountId,
  onUpdate,
  onDelete,
}: Props) => {
  const { setOpen } = useModal()
  const router = useRouter()
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)

  const handleTicketUpdate = (updatedTicket: TicketWithTags[0]) => {
    // Ticket value is already serialized from server action
    const serializedTicket = updatedTicket as SerializedTicket
    onUpdate(serializedTicket)
  }

  const handleEdit = () => {
    console.log('[PipelineTicketCard] Edit clicked for:', ticket.name)
    setDropdownOpen(false) // Close the dropdown
    console.log('[PipelineTicketCard] Opening modal...')
    setOpen(
      <CustomModal title="Update Ticket Details" subheading="">
        <TicketForm
          getNewTicket={handleTicketUpdate}
          laneId={ticket.laneId}
          subaccountId={subaccountId}
        />
      </CustomModal>,
      async () => {
        console.log(
          '[PipelineTicketCard] Fetching data for ticket:',
          ticket.name
        )
        return { ticket: ticket }
      }
    )
    console.log('[PipelineTicketCard] Modal should be open now')
  }

  const handleDeleteClick = () => {
    console.log('[PipelineTicketCard] Delete clicked for:', ticket.name)
    setDropdownOpen(false) // Close the dropdown
    setDeleteDialogOpen(true) // Open delete confirmation dialog
  }

  const handleDeleteConfirm = async () => {
    console.log('[PipelineTicketCard] Delete confirmed for:', ticket.name)
    setDeleteDialogOpen(false) // Close the dialog

    try {
      await deleteTicket(ticket.id)
      onDelete(ticket.id)

      toast({
        title: 'Deleted',
        description: 'Ticket deleted successfully.',
      })

      await saveActivityLogsNotification({
        businessId: undefined,
        description: `Deleted ticket | ${ticket.name}`,
        subaccountId: subaccountId,
      })

      router.refresh()
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Could not delete the ticket.',
      })
      console.log(error)
    }
  }

  const dateFormatter = new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })

  const shortDateFormatter = new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
  })

  return (
    <div className="flex items-start justify-between gap-2">
      <div className="flex flex-1 flex-col gap-1">
        <p className="m-0 text-sm font-medium">{ticket.name}</p>
        <p className="m-0 text-xs text-muted-foreground">
          {ticket.createdAt && shortDateFormatter.format(ticket.createdAt)} -{' '}
          {ticket.createdAt && dateFormatter.format(ticket.createdAt)}
        </p>
      </div>
      <DropdownMenu open={dropdownOpen} onOpenChange={setDropdownOpen}>
        <div className="flex items-center gap-1" data-no-drag="true">
          {ticket.Assigned && (
            <Avatar className="h-4 w-4 flex-shrink-0">
              <AvatarImage src={ticket.Assigned.avatarUrl} />
              <AvatarFallback className="text-[8px]">
                {ticket.Assigned.name?.slice(0, 2)}
              </AvatarFallback>
            </Avatar>
          )}
          <DropdownMenuTrigger asChild>
            <button
              className="flex h-5 w-5 items-center justify-center rounded opacity-0 transition-opacity hover:bg-muted group-hover:opacity-100"
              data-no-drag="true"
              type="button"
            >
              <MoreHorizontal className="h-3 w-3 text-muted-foreground" />
            </button>
          </DropdownMenuTrigger>
        </div>

        <DropdownMenuContent align="end" sideOffset={5} className="z-[100]">
          <DropdownMenuLabel>Options</DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            className="flex items-center gap-2"
            onPointerDown={e => {
              e.preventDefault()
              e.stopPropagation()
              console.log(
                '[DropdownMenuItem] onPointerDown - calling handleEdit'
              )
              handleEdit()
            }}
            onSelect={e => {
              e.preventDefault()
            }}
          >
            <Edit size={15} />
            Edit Ticket
          </DropdownMenuItem>
          <DropdownMenuItem
            className="flex items-center gap-2"
            onPointerDown={e => {
              e.preventDefault()
              e.stopPropagation()
              console.log(
                '[DropdownMenuItem] onPointerDown - calling handleDeleteClick'
              )
              handleDeleteClick()
            }}
            onSelect={e => {
              e.preventDefault()
            }}
          >
            <Trash size={15} />
            Delete Ticket
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete the
              ticket and remove it from the pipeline.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel
              onPointerDown={e => {
                e.preventDefault()
                e.stopPropagation()
                console.log(
                  '[AlertDialogCancel] onPointerDown - closing dialog'
                )
                setDeleteDialogOpen(false)
              }}
            >
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive"
              onPointerDown={e => {
                e.preventDefault()
                e.stopPropagation()
                console.log(
                  '[AlertDialogAction] onPointerDown - calling handleDeleteConfirm'
                )
                handleDeleteConfirm()
              }}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

export default PipelineTicketCard
