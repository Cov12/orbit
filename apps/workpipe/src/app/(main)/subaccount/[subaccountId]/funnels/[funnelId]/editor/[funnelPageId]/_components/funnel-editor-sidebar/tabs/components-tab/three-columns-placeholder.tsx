import React from 'react'

import { Columns3 } from 'lucide-react'

import { EditorBtns } from '@/lib/constants'

type Props = Record<string, never>

const ThreeColumnsPlaceholder = (props: Props) => {
  const handleDragState = (e: React.DragEvent, type: EditorBtns) => {
    if (type === null) return
    e.dataTransfer.setData('componentType', type)
  }

  return (
    <div
      draggable
      onDragStart={e => handleDragState(e, '3Col')}
      className="flex h-14 w-14 cursor-grab flex-col items-center justify-center rounded-lg bg-muted p-2"
    >
      <Columns3 size={28} className="text-muted-foreground" />
    </div>
  )
}

export default ThreeColumnsPlaceholder
