'use client'

import React from 'react'

import { EditorElement, useEditor } from '@/providers/editor/editor-provider'

import BaseFunnelComponent from '../base-funnel-component'

interface SpacerContent {
  height: string
}

interface SpacerComponentProps {
  element: EditorElement
}

const SpacerComponent: React.FC<SpacerComponentProps> = ({ element }) => {
  const { state } = useEditor()
  const content = element.content as SpacerContent

  const spacerStyles = {
    height: content?.height || '50px',
    width: '100%',
    backgroundColor: state.editor.liveMode ? 'transparent' : '#f8f9fa',
    border: state.editor.liveMode ? 'none' : '1px dashed #e5e5e5',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: '#9ca3af',
    fontSize: '12px',
    fontFamily: 'monospace',
  }

  return (
    <BaseFunnelComponent element={element} className="w-full">
      <div style={spacerStyles}>
        {!state.editor.liveMode && `Spacer (${content?.height || '50px'})`}
      </div>
    </BaseFunnelComponent>
  )
}

export default SpacerComponent