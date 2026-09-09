'use client'
import { useEffect, useState } from 'react'

import { Tag } from '@prisma/client'
import { usePathname, useRouter } from 'next/navigation'

import { Button } from '@/components/ui/button'
import { getTagsForSubaccount } from '@/lib/queries'

import TagComponent from './tag'

type Props = {
  subAccountId: string
  selectedTagIds: string[]
}

/**
 * Tag filter bar for the contacts list (issue #54 phase 5).
 *
 * The selection lives in the URL (`?tags=id1,id2`) so the server page can read
 * it and query filtered. `selectedTagIds` is passed down from that server read
 * rather than pulled from useSearchParams, which would force this subtree into
 * a Suspense boundary.
 */
const ContactTagFilter = ({ subAccountId, selectedTagIds }: Props) => {
  const [tags, setTags] = useState<Tag[]>([])
  const router = useRouter()
  const pathname = usePathname()

  useEffect(() => {
    const fetchData = async () => {
      const response = await getTagsForSubaccount(subAccountId)
      if (response) setTags(response.Tags)
    }
    fetchData()
  }, [subAccountId])

  const pushSelection = (next: string[]) => {
    router.replace(
      next.length ? `${pathname}?tags=${next.join(',')}` : pathname
    )
  }

  const toggleTag = (tagId: string) => {
    pushSelection(
      selectedTagIds.includes(tagId)
        ? selectedTagIds.filter(id => id !== tagId)
        : [...selectedTagIds, tagId]
    )
  }

  if (!tags.length) return null

  return (
    <div className="flex flex-wrap items-center gap-2 px-4 pb-4">
      <span className="text-sm text-muted-foreground">Filter by tag:</span>
      {tags.map(tag => (
        <div
          key={tag.id}
          onClick={() => toggleTag(tag.id)}
          className={
            selectedTagIds.includes(tag.id)
              ? 'rounded-sm ring-2 ring-primary'
              : 'rounded-sm opacity-60 hover:opacity-100'
          }
        >
          <TagComponent title={tag.name} colorName={tag.color} />
        </div>
      ))}
      {!!selectedTagIds.length && (
        <Button variant="ghost" size="sm" onClick={() => pushSelection([])}>
          Clear
        </Button>
      )}
    </div>
  )
}

export default ContactTagFilter
