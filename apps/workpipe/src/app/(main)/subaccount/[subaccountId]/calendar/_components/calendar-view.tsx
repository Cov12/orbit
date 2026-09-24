'use client'

import { useCallback, useState } from 'react'

import FullCalendar from '@fullcalendar/react'
import dayGridPlugin from '@fullcalendar/daygrid'
import timeGridPlugin from '@fullcalendar/timegrid'
import interactionPlugin from '@fullcalendar/interaction'
import listPlugin from '@fullcalendar/list'
import { DateSelectArg, EventClickArg, EventDropArg } from '@fullcalendar/core'
import { EventResizeDoneArg } from '@fullcalendar/interaction'
import { Contact } from '@prisma/client'

import { upsertCalendarEvent } from '@/lib/queries/calendar'

import CalendarEventModal from './calendar-event-modal'

export type CalendarEventData = {
  id: string
  title: string
  description: string | null
  start: string
  end: string | null
  allDay: boolean
  color: string | null
  subAccountId: string
  contactId: string | null
  ticketId: string | null
  category: string | null
}

type Props = {
  events: CalendarEventData[]
  subAccountId: string
  contacts: Contact[]
}

const CalendarView = ({ events, subAccountId, contacts }: Props) => {
  const [modalOpen, setModalOpen] = useState(false)
  const [selectedEvent, setSelectedEvent] = useState<CalendarEventData | null>(null)
  const [defaultStart, setDefaultStart] = useState<string>('')
  const [defaultEnd, setDefaultEnd] = useState<string>('')
  const [defaultAllDay, setDefaultAllDay] = useState(false)

  const handleDateSelect = useCallback((selectInfo: DateSelectArg) => {
    setSelectedEvent(null)
    setDefaultStart(selectInfo.startStr)
    setDefaultEnd(selectInfo.endStr)
    setDefaultAllDay(selectInfo.allDay)
    setModalOpen(true)
  }, [])

  const handleEventClick = useCallback(
    (clickInfo: EventClickArg) => {
      const event = events.find((e) => e.id === clickInfo.event.id)
      if (event) {
        setSelectedEvent(event)
        setDefaultStart(event.start)
        setDefaultEnd(event.end || '')
        setDefaultAllDay(event.allDay)
        setModalOpen(true)
      }
    },
    [events]
  )

  const handleEventDrop = useCallback(
    async (dropInfo: EventDropArg) => {
      const event = events.find((e) => e.id === dropInfo.event.id)
      if (!event) return

      await upsertCalendarEvent({
        id: event.id,
        title: event.title,
        description: event.description || undefined,
        start: dropInfo.event.startStr,
        end: dropInfo.event.endStr || undefined,
        allDay: dropInfo.event.allDay,
        color: event.color || undefined,
        subAccountId,
        contactId: event.contactId || undefined,
        ticketId: event.ticketId || undefined,
        category: event.category || undefined,
      })
    },
    [events, subAccountId]
  )

  const handleEventResize = useCallback(
    async (resizeInfo: EventResizeDoneArg) => {
      const event = events.find((e) => e.id === resizeInfo.event.id)
      if (!event) return

      await upsertCalendarEvent({
        id: event.id,
        title: event.title,
        description: event.description || undefined,
        start: resizeInfo.event.startStr,
        end: resizeInfo.event.endStr || undefined,
        allDay: resizeInfo.event.allDay,
        color: event.color || undefined,
        subAccountId,
        contactId: event.contactId || undefined,
        ticketId: event.ticketId || undefined,
        category: event.category || undefined,
      })
    },
    [events, subAccountId]
  )

  const calendarEvents = events.map((event) => ({
    id: event.id,
    title: event.title,
    start: event.start,
    end: event.end || undefined,
    allDay: event.allDay,
    backgroundColor: event.color || '#7c3aed',
    borderColor: event.color || '#7c3aed',
  }))

  return (
    <div className="p-4">
      <style>{`
        .fc {
          --fc-border-color: hsl(var(--border));
          --fc-button-bg-color: hsl(var(--primary));
          --fc-button-border-color: hsl(var(--primary));
          --fc-button-hover-bg-color: hsl(var(--primary) / 0.8);
          --fc-button-hover-border-color: hsl(var(--primary) / 0.8);
          --fc-button-active-bg-color: hsl(var(--primary) / 0.9);
          --fc-button-active-border-color: hsl(var(--primary) / 0.9);
          --fc-event-bg-color: #7c3aed;
          --fc-event-border-color: #7c3aed;
          --fc-today-bg-color: hsl(var(--muted) / 0.3);
          --fc-page-bg-color: transparent;
          --fc-neutral-bg-color: hsl(var(--muted) / 0.2);
          --fc-list-event-hover-bg-color: hsl(var(--muted) / 0.3);
          color: hsl(var(--foreground));
        }
        .fc .fc-daygrid-day-number,
        .fc .fc-col-header-cell-cushion {
          color: hsl(var(--foreground));
          text-decoration: none;
        }
        .fc .fc-button {
          font-size: 0.875rem;
          padding: 0.375rem 0.75rem;
          border-radius: 0.375rem;
        }
        .fc .fc-toolbar-title {
          font-size: 1.25rem;
          font-weight: 600;
        }
        .fc .fc-scrollgrid {
          border-radius: 0.5rem;
          overflow: hidden;
        }
        .fc td, .fc th {
          border-color: hsl(var(--border));
        }
        .fc .fc-event {
          border-radius: 0.25rem;
          font-size: 0.8rem;
          cursor: pointer;
        }
        .fc .fc-daygrid-event {
          padding: 2px 4px;
        }
      `}</style>
      <FullCalendar
        plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin, listPlugin]}
        initialView="dayGridMonth"
        headerToolbar={{
          left: 'prev,next today',
          center: 'title',
          right: 'dayGridMonth,timeGridWeek,timeGridDay,listWeek',
        }}
        events={calendarEvents}
        selectable={true}
        editable={true}
        select={handleDateSelect}
        eventClick={handleEventClick}
        eventDrop={handleEventDrop}
        eventResize={handleEventResize}
        height="auto"
        nowIndicator={true}
        timeZone="UTC"
      />
      <CalendarEventModal
        open={modalOpen}
        onOpenChange={setModalOpen}
        event={selectedEvent}
        subAccountId={subAccountId}
        contacts={contacts}
        defaultStart={defaultStart}
        defaultEnd={defaultEnd}
        defaultAllDay={defaultAllDay}
      />
    </div>
  )
}

export default CalendarView
