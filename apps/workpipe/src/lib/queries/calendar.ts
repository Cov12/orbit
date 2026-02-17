'use server'

import { revalidatePath } from 'next/cache'

import { db } from '@/lib/db'

export type CalendarEventFormData = {
  id?: string
  title: string
  description?: string
  start: string
  end?: string
  allDay?: boolean
  color?: string
  subAccountId: string
  contactId?: string
  ticketId?: string
  category?: string
}

export const getCalendarEvents = async (
  subAccountId: string,
  startDate?: Date,
  endDate?: Date
) => {
  const where: any = { subAccountId }

  if (startDate && endDate) {
    where.start = {
      gte: startDate,
      lte: endDate,
    }
  } else if (startDate) {
    where.start = { gte: startDate }
  } else if (endDate) {
    where.start = { lte: endDate }
  }

  try {
    return await db.calendarEvent.findMany({
      where,
      orderBy: { start: 'asc' },
    })
  } catch (error) {
    console.error('CalendarEvent query failed (table may not exist yet - run prisma db push):', error)
    return []
  }
}

export const getCalendarEventById = async (eventId: string) => {
  return await db.calendarEvent.findUnique({
    where: { id: eventId },
    include: {
      Contact: true,
      Ticket: true,
    },
  })
}

export const upsertCalendarEvent = async (event: CalendarEventFormData) => {
  const data = {
    title: event.title,
    description: event.description || null,
    start: new Date(event.start),
    end: event.end ? new Date(event.end) : null,
    allDay: event.allDay || false,
    color: event.color || null,
    subAccountId: event.subAccountId,
    contactId: event.contactId || null,
    ticketId: event.ticketId || null,
    category: event.category || null,
  }

  const result = event.id
    ? await db.calendarEvent.update({
        where: { id: event.id },
        data,
      })
    : await db.calendarEvent.create({
        data,
      })

  revalidatePath(`/subaccount/${event.subAccountId}/calendar`)
  return result
}

export const deleteCalendarEvent = async (eventId: string) => {
  const event = await db.calendarEvent.delete({
    where: { id: eventId },
  })

  revalidatePath(`/subaccount/${event.subAccountId}/calendar`)
  return event
}
