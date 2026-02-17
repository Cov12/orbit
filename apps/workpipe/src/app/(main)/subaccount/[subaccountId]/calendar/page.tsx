import { Contact } from '@prisma/client'

import BlurPage from '@/components/global/blur-page'
import { db } from '@/lib/db'
import { getCalendarEvents } from '@/lib/queries/calendar'

import CalendarView from './_components/calendar-view'

type Props = {
  params: Promise<{ subaccountId: string }>
}

const CalendarPage = async ({ params }: Props) => {
  const { subaccountId } = await params

  const events = await getCalendarEvents(subaccountId)

  const subAccount = await db.subAccount.findUnique({
    where: { id: subaccountId },
    include: {
      Contact: {
        orderBy: { name: 'asc' },
      },
    },
  })

  const contacts: Contact[] = subAccount?.Contact ?? []

  const serializedEvents = events.map((event) => ({
    id: event.id,
    title: event.title,
    description: event.description,
    start: event.start.toISOString(),
    end: event.end?.toISOString() ?? null,
    allDay: event.allDay,
    color: event.color,
    subAccountId: event.subAccountId,
    contactId: event.contactId,
    ticketId: event.ticketId,
    category: event.category,
  }))

  return (
    <BlurPage>
      <h1 className="p-4 text-4xl">Calendar</h1>
      <CalendarView
        events={serializedEvents}
        subAccountId={subaccountId}
        contacts={contacts}
      />
    </BlurPage>
  )
}

export default CalendarPage
