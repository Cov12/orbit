'use client'

import React from 'react'

import { EditorElement } from '@/providers/editor/editor-provider'

import BaseFunnelComponent from '../base-funnel-component'

interface DividerContent {
  style: 'solid' | 'dashed' | 'dotted' | 'double'
  thickness: number
  color: string
  margin: string
  width?: string
}

interface DividerComponentProps {
  element: EditorElement
}

const DividerComponent: React.FC<DividerComponentProps> = ({ element }) => {
  const content = element.content as DividerContent

  const dividerStyles = {
    margin: content?.margin || '20px 0',
    padding: '0 10px',
  }

  const lineStyles = {
    borderTop: `${content?.thickness || 1}px ${content?.style || 'solid'} ${content?.color || '#e5e5e5'}`,
    width: content?.width || '100%',
    margin: 0,
  }

  return (
    <BaseFunnelComponent element={element} className="w-full">
      <div style={dividerStyles}>
        <hr style={lineStyles} />
      </div>
    </BaseFunnelComponent>
  )
}

export default DividerComponent