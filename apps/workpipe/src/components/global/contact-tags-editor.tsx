'use client'
import { useRef } from 'react'

import { Tag } from '@prisma/client'
import { useRouter } from 'next/navigation'

import { addTagToContact, removeTagFromContact } from '@/lib/queries'

import { toast } from '../ui/use-toast'

import TagCreator from './tag-creator'

type Props = {
  contactId: string
  subAccountId: string
  contactTags: Tag[]
}

/**
 * Tag editor for a single contact (issue #54 phase 5).
 *
 * Reuses TagCreator unchanged: it owns the sub-account tag vocabulary and the
 * selection UI, and hands us the full selection on every change. We diff that
 * against a baseline and persist only the delta through addTagToContact /
 * removeTagFromContact, so the contact write path (upsertContact) stays
 * untouched.
 */
const ContactTagsEditor = ({ contactId, subAccountId, contactTags }: Props) => {
  const router = useRouter()
  // A ref, not state: TagCreator re-invokes getSelectedTags on every selection
  // change, and re-rendering on the baseline would reset its own state.
  const baseline = useRef<Tag[]>(contactTags)

  const handleSelectedTags = async (next: Tag[]) => {
    const current = baseline.current
    const added = next.filter(t => current.every(c => c.id !== t.id))
    const removed = current.filter(c => next.every(t => t.id !== c.id))
    if (!added.length && !removed.length) return

    baseline.current = next
    try {
      await Promise.all([
        ...added.map(tag => addTagToContact(contactId, tag.id)),
        ...removed.map(tag => removeTagFromContact(contactId, tag.id)),
      ])
      router.refresh()
    } catch {
      baseline.current = current
      toast({
        variant: 'destructive',
        title: 'Could not update the contact tags',
      })
    }
  }

  return (
    <TagCreator
      subAccountId={subAccountId}
      getSelectedTags={handleSelectedTags}
      defaultTags={contactTags}
    />
  )
}

export default ContactTagsEditor
