'use client'
import React from 'react'

import { Minus } from 'lucide-react'

import { EditorBtns } from '@/lib/constants'

type Props = Record<string, never>

const DividerPlaceholder = (props: Props) => {
  const handleDragStart = (e: React.DragEvent, type: EditorBtns) => {
    if (type === null) return
    e.dataTransfer.setData('componentType', type)
  }
  return (
    <div
      draggable
      onDragStart={e => handleDragStart(e, 'divider')}
      className="flex h-14 w-14 cursor-grab items-center justify-center rounded-lg bg-muted transition-colors hover:bg-muted/80"
    >
      <Minus className="h-6 w-6" />
    </div>
  )
}

export default DividerPlaceholder
