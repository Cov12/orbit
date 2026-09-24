'use client'
import { useEffect, useState } from 'react'

import { Tag } from '@prisma/client'
import { usePathname, useRouter } from 'next/navigation'

import { Button } from '@/components/ui/button'
import { getTagsForSubaccount } from '@/lib/queries'

import TagComponent from './tag'

type TagMatchMode = 'any' | 'all'

type Props = {
  subAccountId: string
  selectedTagIds: string[]
  selectedMode: TagMatchMode
}

/**
 * Tag filter bar for the contacts list (issue #54 phase 5).
 *
 * The selection lives in the URL (`?tags=id1,id2&tagMode=any|all`) so the
 * server page can read it and query filtered. `selectedTagIds`/`selectedMode`
 * are passed down from that server read rather than pulled from
 * useSearchParams, which would force this subtree into a Suspense boundary.
 */
const ContactTagFilter = ({
  subAccountId,
  selectedTagIds,
  selectedMode,
}: Props) => {
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

  // Both params are written together so a tag toggle keeps the current mode
  // and a mode switch keeps the current tags. `any` is the page's default, so
  // it stays out of the URL.
  const push = (next: string[], mode: TagMatchMode) => {
    const params = new URLSearchParams()
    if (next.length) params.set('tags', next.join(','))
    if (mode !== 'any') params.set('tagMode', mode)
    const query = params.toString()
    router.replace(query ? `${pathname}?${query}` : pathname)
  }

  const pushSelection = (next: string[]) => push(next, selectedMode)

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
      <div className="flex items-center overflow-hidden rounded-md border">
        {(['any', 'all'] as TagMatchMode[]).map(mode => (
          <Button
            key={mode}
            type="button"
            variant={selectedMode === mode ? 'secondary' : 'ghost'}
            size="sm"
            className="h-7 rounded-none px-2 text-xs capitalize"
            onClick={() => push(selectedTagIds, mode)}
          >
            {mode}
          </Button>
        ))}
      </div>
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
