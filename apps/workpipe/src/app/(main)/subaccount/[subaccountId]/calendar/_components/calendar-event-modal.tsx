'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Contact } from '@prisma/client'

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Switch } from '@/components/ui/switch'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
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

import {
  upsertCalendarEvent,
  deleteCalendarEvent,
} from '@/lib/queries/calendar'
import { CalendarEventData } from './calendar-view'

const CATEGORIES = ['Sales', 'Customer', 'Operations', 'Marketing', 'General']
const COLORS = [
  { label: 'Purple', value: '#7c3aed' },
  { label: 'Blue', value: '#2563eb' },
  { label: 'Green', value: '#16a34a' },
  { label: 'Red', value: '#dc2626' },
  { label: 'Orange', value: '#ea580c' },
  { label: 'Pink', value: '#db2777' },
  { label: 'Teal', value: '#0d9488' },
]

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  event: CalendarEventData | null
  subAccountId: string
  contacts: Contact[]
  defaultStart: string
  defaultEnd: string
  defaultAllDay: boolean
}

const CalendarEventModal = ({
  open,
  onOpenChange,
  event,
  subAccountId,
  contacts,
  defaultStart,
  defaultEnd,
  defaultAllDay,
}: Props) => {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  const formatForInput = (dateStr: string, allDay: boolean) => {
    if (!dateStr) return ''
    try {
      const d = new Date(dateStr)
      if (allDay) return d.toISOString().split('T')[0]
      return d.toISOString().slice(0, 16)
    } catch {
      return dateStr
    }
  }

  const isEdit = !!event?.id

  const handleSubmit = (formData: FormData) => {
    const title = formData.get('title') as string
    if (!title) return

    const allDay = formData.get('allDay') === 'on'
    const start = formData.get('start') as string
    const end = formData.get('end') as string
    const contactId = formData.get('contactId') as string
    const category = formData.get('category') as string
    const color = formData.get('color') as string

    startTransition(async () => {
      await upsertCalendarEvent({
        id: event?.id,
        title,
        description: (formData.get('description') as string) || undefined,
        start,
        end: end || undefined,
        allDay,
        color: color || undefined,
        subAccountId,
        contactId: contactId || undefined,
        category: category || undefined,
      })
      onOpenChange(false)
      router.refresh()
    })
  }

  const handleDelete = () => {
    if (!event?.id) return
    startTransition(async () => {
      await deleteCalendarEvent(event.id)
      onOpenChange(false)
      router.refresh()
    })
  }

  const initAllDay = event ? event.allDay : defaultAllDay
  const initStart = formatForInput(event?.start || defaultStart, initAllDay)
  const initEnd = formatForInput(event?.end || defaultEnd, initAllDay)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Edit Event' : 'New Event'}</DialogTitle>
        </DialogHeader>
        <form action={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="title">Title</Label>
            <Input
              id="title"
              name="title"
              defaultValue={event?.title || ''}
              placeholder="Event title"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              name="description"
              defaultValue={event?.description || ''}
              placeholder="Optional description"
              rows={3}
            />
          </div>

          <div className="flex items-center gap-2">
            <Switch
              id="allDay"
              name="allDay"
              defaultChecked={initAllDay}
            />
            <Label htmlFor="allDay">All day</Label>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="start">Start</Label>
              <Input
                id="start"
                name="start"
                type={initAllDay ? 'date' : 'datetime-local'}
                defaultValue={initStart}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="end">End</Label>
              <Input
                id="end"
                name="end"
                type={initAllDay ? 'date' : 'datetime-local'}
                defaultValue={initEnd}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Color</Label>
              <Select name="color" defaultValue={event?.color || '#7c3aed'}>
                <SelectTrigger>
                  <SelectValue placeholder="Select color" />
                </SelectTrigger>
                <SelectContent>
                  {COLORS.map((c) => (
                    <SelectItem key={c.value} value={c.value}>
                      <div className="flex items-center gap-2">
                        <div
                          className="h-3 w-3 rounded-full"
                          style={{ backgroundColor: c.value }}
                        />
                        {c.label}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Category</Label>
              <Select name="category" defaultValue={event?.category || ''}>
                <SelectTrigger>
                  <SelectValue placeholder="Select category" />
                </SelectTrigger>
                <SelectContent>
                  {CATEGORIES.map((cat) => (
                    <SelectItem key={cat} value={cat}>
                      {cat}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {contacts.length > 0 && (
            <div className="space-y-2">
              <Label>Contact</Label>
              <Select name="contactId" defaultValue={event?.contactId || ''}>
                <SelectTrigger>
                  <SelectValue placeholder="Link a contact (optional)" />
                </SelectTrigger>
                <SelectContent>
                  {contacts.map((contact) => (
                    <SelectItem key={contact.id} value={contact.id}>
                      {contact.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <DialogFooter className="gap-2">
            {isEdit && (
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button type="button" variant="destructive" disabled={isPending}>
                    Delete
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Delete event?</AlertDialogTitle>
                    <AlertDialogDescription>
                      This action cannot be undone.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction onClick={handleDelete}>
                      Delete
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            )}
            <Button type="submit" disabled={isPending}>
              {isPending ? 'Saving...' : isEdit ? 'Update' : 'Create'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

export default CalendarEventModal
