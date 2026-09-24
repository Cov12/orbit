import React from 'react'

import { format } from 'date-fns/format'

import BlurPage from '@/components/global/blur-page'
import ContactTagFilter from '@/components/global/contact-tag-filter'
import TagComponent from '@/components/global/tag'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { getSubAccountContacts } from '@/lib/queries'

import CraeteContactButton from './_components/create-contact-btn'
import EditContactTagsButton from './_components/edit-contact-tags-btn'

type Props = {
  params: Promise<{ subaccountId: string }>
  searchParams: Promise<{ tags?: string; tagMode?: string }>
}

type ContactWithTags = Awaited<ReturnType<typeof getSubAccountContacts>>[number]

const ContactPage = async ({ params, searchParams }: Props) => {
  const { subaccountId } = await params
  const { tags, tagMode } = await searchParams

  // `?tags=id1,id2` narrows the list by tag; `?tagMode=all` requires every
  // selected tag rather than any one of them.
  const tagIds = tags
    ?.split(',')
    .map(id => id.trim())
    .filter(Boolean)
  const selectedTagIds = tagIds?.length ? tagIds : undefined
  const selectedMode = tagMode === 'all' ? 'all' : 'any'

  const allContacts = await getSubAccountContacts(
    subaccountId,
    selectedTagIds,
    selectedMode
  )

  const formatTotal = (tickets: ContactWithTags['Ticket']) => {
    if (!tickets || !tickets.length) return '$0.00'
    const amt = new Intl.NumberFormat(undefined, {
      style: 'currency',
      currency: 'USD',
    })

    const laneAmt = tickets.reduce(
      (sum, ticket) => sum + (Number(ticket?.value) || 0),
      0
    )

    return amt.format(laneAmt)
  }
  return (
    <BlurPage>
      <h1 className="p-4 text-4xl">Contacts</h1>
      <CraeteContactButton subaccountId={subaccountId} />
      <ContactTagFilter
        subAccountId={subaccountId}
        selectedTagIds={selectedTagIds ?? []}
        selectedMode={selectedMode}
      />
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-[200px]">Name</TableHead>
            <TableHead className="w-[300px]">Email</TableHead>
            <TableHead className="w-[250px]">Tags</TableHead>
            <TableHead className="w-[200px]">Active</TableHead>
            <TableHead>Created Date</TableHead>
            <TableHead className="text-right">Total Value</TableHead>
            <TableHead className="w-[60px]"></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody className="truncate font-medium">
          {allContacts.map(contact => (
            <TableRow key={contact.id}>
              <TableCell>
                <Avatar>
                  <AvatarImage alt="@shadcn" />
                  <AvatarFallback className="bg-primary text-white">
                    {contact.name.slice(0, 2).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
              </TableCell>
              <TableCell>{contact.email}</TableCell>
              <TableCell>
                <div className="flex flex-wrap gap-1">
                  {contact.Tags.map(tag => (
                    <TagComponent
                      key={tag.id}
                      title={tag.name}
                      colorName={tag.color}
                    />
                  ))}
                </div>
              </TableCell>
              <TableCell>
                {formatTotal(contact.Ticket) === '$0.00' ? (
                  <Badge variant={'destructive'}>Inactive</Badge>
                ) : (
                  <Badge className="bg-emerald-700">Active</Badge>
                )}
              </TableCell>
              <TableCell>{format(contact.createdAt, 'MM/dd/yyyy')}</TableCell>
              <TableCell className="text-right">
                {formatTotal(contact.Ticket)}
              </TableCell>
              <TableCell className="text-right">
                <EditContactTagsButton
                  contactId={contact.id}
                  contactName={contact.name}
                  subaccountId={subaccountId}
                  contactTags={contact.Tags}
                />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </BlurPage>
  )
}

export default ContactPage
