import React from 'react'

import { Contact2Icon } from 'lucide-react'

import { EditorBtns } from '@/lib/constants'

type Props = Record<string, never>

const ContactFormComponentPlaceholder = (props: Props) => {
  const handleDragStart = (e: React.DragEvent, type: EditorBtns) => {
    if (type === null) return
    e.dataTransfer.setData('componentType', type)
  }
  return (
    <div
      draggable
      onDragStart={e => handleDragStart(e, 'contactForm')}
      className="flex h-14 w-14 items-center justify-center rounded-lg bg-muted"
    >
      <Contact2Icon size={40} className="text-muted-foreground" />
    </div>
  )
}

export default ContactFormComponentPlaceholder
