'use client'
import React from 'react'

import { Code } from 'lucide-react'

import { EditorBtns } from '@/lib/constants'

type Props = {}

const CodeBlockPlaceholder = (props: Props) => {
  const handleDragStart = (e: React.DragEvent, type: EditorBtns) => {
    if (type === null) return
    e.dataTransfer.setData('componentType', type)
  }
  return (
    <div
      draggable
      onDragStart={(e) => handleDragStart(e, 'code-block')}
      className="h-14 w-14 bg-muted rounded-lg flex items-center justify-center cursor-grab hover:bg-muted/80 transition-colors"
    >
      <Code className="h-6 w-6" />
    </div>
  )
}

export default CodeBlockPlaceholder