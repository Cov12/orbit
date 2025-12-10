import { Dispatch, SetStateAction } from 'react'

import { Contact2, Edit, MoreHorizontalIcon, Trash, User2 } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { Draggable } from 'react-beautiful-dnd'

import TicketForm from '@/components/forms/ticket-form'
import CustomModal from '@/components/global/custom-modal'
import TagComponent from '@/components/global/tag'
import LinkIcon from '@/components/icons/link'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import {
  Card,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from '@/components/ui/hover-card'
import { toast } from '@/components/ui/use-toast'
import { deleteTicket, saveActivityLogsNotification } from '@/lib/queries'
import { TicketWithTags } from '@/lib/types'
import { useModal } from '@/providers/modal-provider'

type Props = {
  setAllTickets: Dispatch<SetStateAction<TicketWithTags>>
  ticket: TicketWithTags[0]
  subaccountId: string
  allTickets: TicketWithTags
  index: number
}

const PipelineTicket = ({
  allTickets,
  index,
  setAllTickets,
  subaccountId,
  ticket,
}: Props) => {
  const router = useRouter()
  const { setOpen } = useModal()

  const editNewTicket = (ticket: TicketWithTags[0]) => {
    setAllTickets(() =>
      allTickets.map(t => {
        if (t.id === ticket.id) {
          return ticket
        }
        return t
      })
    )
  }

  const handleClickEdit = async () => {
    setOpen(
      <CustomModal title="Update Ticket Details" subheading="">
        <TicketForm
          getNewTicket={editNewTicket}
          laneId={ticket.laneId}
          subaccountId={subaccountId}
        />
      </CustomModal>,
      async () => {
        return { ticket: ticket }
      }
    )
  }

  const handleDeleteTicket = async () => {
    try {
      setAllTickets(tickets => tickets.filter(t => t.id !== ticket.id))
      const response = await deleteTicket(ticket.id)
      toast({
        title: 'Deleted',
        description: 'Deleted ticket from lane.',
      })

      await saveActivityLogsNotification({
        businessId: undefined,
        description: `Deleted a ticket | ${response?.name}`,
        subaccountId: subaccountId,
      })

      router.refresh()
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Oppse!',
        description: 'Could not delete the ticket.',
      })
      console.log(error)
    }
  }
  return (
    <Draggable draggableId={ticket.id.toString()} index={index}>
      {(provided, snapshot) => {
        if (snapshot.isDragging) {
          const offset = { x: 300, y: 20 }
          // @ts-expect-error - Style properties may not match exact types
          const x = provided.draggableProps.style?.left - offset.x
          // @ts-expect-error - Style properties may not match exact types
          const y = provided.draggableProps.style?.top - offset.y
          // @ts-expect-error - Modifying draggable style for custom positioning
          provided.draggableProps.style = {
            ...provided.draggableProps.style,
            top: y,
            left: x,
          }
        }
        return (
          <div
            {...provided.draggableProps}
            {...provided.dragHandleProps}
            ref={provided.innerRef}
          >
            <AlertDialog>
              <DropdownMenu>
                <Card className="my-4 bg-white shadow-none transition-all dark:bg-slate-900">
                  <CardHeader className="p-[12px]">
                    <CardTitle className="flex items-center justify-between">
                      <span className="w-full overflow-hidden text-ellipsis whitespace-nowrap text-lg">
                        {ticket.name}
                      </span>
                      <DropdownMenuTrigger>
                        <MoreHorizontalIcon className="flex-shrink-0 text-muted-foreground" />
                      </DropdownMenuTrigger>
                    </CardTitle>
                    <span className="text-xs text-muted-foreground">
                      {new Date().toLocaleDateString()}
                    </span>
                    <div className="flex flex-wrap items-center gap-2">
                      {ticket.Tags.map(tag => (
                        <TagComponent
                          key={tag.id}
                          title={tag.name}
                          colorName={tag.color}
                        />
                      ))}
                    </div>
                    <CardDescription className="line-clamp-3 w-full overflow-hidden text-ellipsis">
                      {ticket.description}
                    </CardDescription>
                    <HoverCard>
                      <HoverCardTrigger asChild>
                        <div className="flex cursor-pointer items-center gap-2 rounded-lg p-2 text-muted-foreground transition-all hover:bg-muted">
                          <LinkIcon />
                          <span className="text-xs font-bold">CONTACT</span>
                        </div>
                      </HoverCardTrigger>
                      <HoverCardContent side="right" className="w-fit">
                        <div className="flex justify-between space-x-4">
                          <Avatar>
                            <AvatarImage />
                            <AvatarFallback className="bg-primary">
                              {ticket.Customer?.name.slice(0, 2).toUpperCase()}
                            </AvatarFallback>
                          </Avatar>
                          <div className="space-y-1">
                            <h4 className="text-sm font-semibold">
                              {ticket.Customer?.name}
                            </h4>
                            <p className="text-sm text-muted-foreground">
                              {ticket.Customer?.email}
                            </p>
                            <div className="flex items-center pt-2">
                              <Contact2 className="mr-2 h-4 w-4 opacity-70" />
                              <span className="text-xs text-muted-foreground">
                                Joined{' '}
                                {ticket.Customer?.createdAt.toLocaleDateString()}
                              </span>
                            </div>
                          </div>
                        </div>
                      </HoverCardContent>
                    </HoverCard>
                  </CardHeader>
                  <CardFooter className="m-0 flex items-center justify-between gap-2 border-t-[1px] border-muted-foreground/20 p-2">
                    <div className="item-center flex min-w-0 flex-1 gap-2">
                      <Avatar className="h-8 w-8 flex-shrink-0">
                        <AvatarImage
                          alt="contact"
                          src={ticket.Assigned?.avatarUrl}
                        />
                        <AvatarFallback className="bg-primary text-sm text-white">
                          {ticket.Assigned?.name}
                          {!ticket.assignedUserId && <User2 size={14} />}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex min-w-0 flex-col justify-center">
                        <span className="text-sm text-muted-foreground">
                          {ticket.assignedUserId
                            ? 'Assigned to'
                            : 'Not Assigned'}
                        </span>
                        {ticket.assignedUserId && (
                          <span className="overflow-hidden overflow-ellipsis whitespace-nowrap text-xs text-muted-foreground">
                            {ticket.Assigned?.name}
                          </span>
                        )}
                      </div>
                    </div>
                    <span className="flex-shrink-0 text-xs font-bold">
                      {!!ticket.value &&
                        new Intl.NumberFormat(undefined, {
                          style: 'currency',
                          currency: 'USD',
                        }).format(+ticket.value)}
                    </span>
                  </CardFooter>
                  <DropdownMenuContent>
                    <DropdownMenuLabel>Options</DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    <AlertDialogTrigger>
                      <DropdownMenuItem className="flex items-center gap-2">
                        <Trash size={15} />
                        Delete Ticket
                      </DropdownMenuItem>
                    </AlertDialogTrigger>
                    <DropdownMenuItem
                      className="flex items-center gap-2"
                      onClick={handleClickEdit}
                    >
                      <Edit size={15} />
                      Edit Ticket
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </Card>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>
                      Are you absolutely sure?
                    </AlertDialogTitle>
                    <AlertDialogDescription>
                      This action cannot be undone. This will permanently delete
                      the ticket and remove it from our servers.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter className="flex items-center">
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction
                      className="bg-destructive"
                      onClick={handleDeleteTicket}
                    >
                      Delete
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </DropdownMenu>
            </AlertDialog>
          </div>
        )
      }}
    </Draggable>
  )
}

export default PipelineTicket
