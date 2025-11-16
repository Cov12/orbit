'use client'

import React from 'react'

import { EditorElement, useEditor } from '@/providers/editor/editor-provider'

import BaseFunnelComponent from '../base-funnel-component'

interface HeadingContent {
  level: 'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6'
  text: string
  alignment: 'left' | 'center' | 'right'
  color: string
  fontSize: string
}

interface HeadingComponentProps {
  element: EditorElement
}

const HeadingComponent: React.FC<HeadingComponentProps> = ({ element }) => {
  const { dispatch, state } = useEditor()
  const content = element.content as HeadingContent

  const HeadingTag = content?.level || 'h1'

  const headingStyles = {
    textAlign: content?.alignment || 'left',
    color: content?.color || '#000000',
    fontSize: content?.fontSize || '2rem',
    margin: 0,
    padding: '10px',
  }

  const handleBlur = (e: React.FocusEvent<HTMLHeadingElement>) => {
    const headingElement = e.target as HTMLHeadingElement
    dispatch({
      type: 'UPDATE_ELEMENT',
      payload: {
        elementDetails: {
          ...element,
          content: {
            ...content,
            text: headingElement.innerText,
          },
        },
      },
    })
  }

  return (
    <BaseFunnelComponent element={element} className="w-full">
      <HeadingTag
        style={headingStyles}
        contentEditable={!state.editor.liveMode}
        onBlur={handleBlur}
        suppressContentEditableWarning={true}
      >
        {content?.text || 'Your Heading Here'}
      </HeadingTag>
    </BaseFunnelComponent>
  )
}

export default HeadingComponent