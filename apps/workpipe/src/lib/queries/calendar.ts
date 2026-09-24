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

/**
 * Parse a date string preserving the intended time.
 * For datetime-local inputs (e.g., "2026-02-17T21:00"), we want to store
 * exactly that time. Using `new Date()` would interpret it as local time
 * on the server (UTC), which is correct for UTC servers but causes offset
 * issues when the user is in a different timezone.
 *
 * We append 'Z' to treat the input as UTC, so the stored time matches
 * what the user typed. FullCalendar will then display it as-is.
 */
const parseDateTime = (dateStr: string): Date => {
  if (!dateStr) return new Date()
  // If it already has timezone info, use as-is
  if (dateStr.endsWith('Z') || dateStr.includes('+') || /T\d{2}:\d{2}:\d{2}.\d+/.test(dateStr)) {
    return new Date(dateStr)
  }
  // For date-only strings (YYYY-MM-DD), treat as midnight UTC
  if (!dateStr.includes('T')) {
    return new Date(dateStr + 'T00:00:00Z')
  }
  // For datetime-local strings (YYYY-MM-DDTHH:mm), treat as UTC
  return new Date(dateStr + ':00Z')
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
    start: parseDateTime(event.start),
    end: event.end ? parseDateTime(event.end) : null,
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
