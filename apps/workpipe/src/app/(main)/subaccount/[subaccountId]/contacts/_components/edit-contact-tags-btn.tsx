'use client'
import React from 'react'

import { Tag } from '@prisma/client'
import { TagIcon } from 'lucide-react'

import ContactTagsEditor from '@/components/global/contact-tags-editor'
import CustomModal from '@/components/global/custom-modal'
import { Button } from '@/components/ui/button'
import { useModal } from '@/providers/modal-provider'

type Props = {
  contactId: string
  contactName: string
  subaccountId: string
  contactTags: Tag[]
}

const EditContactTagsButton = ({
  contactId,
  contactName,
  subaccountId,
  contactTags,
}: Props) => {
  const { setOpen } = useModal()

  const handleEditTags = () => {
    setOpen(
      <CustomModal
        title="Edit contact tags"
        subheading={`Tags applied to ${contactName}.`}
      >
        <ContactTagsEditor
          contactId={contactId}
          subAccountId={subaccountId}
          contactTags={contactTags}
        />
      </CustomModal>
    )
  }

  return (
    <Button
      variant="ghost"
      size="icon"
      aria-label="Edit tags"
      onClick={handleEditTags}
    >
      <TagIcon size={16} />
    </Button>
  )
}

export default EditContactTagsButton
