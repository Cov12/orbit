'use client'

import React, { useState } from 'react'

import { EditorElement, useEditor } from '@/providers/editor/editor-provider'

import BaseFunnelComponent from '../base-funnel-component'

interface RichTextContent {
  content: string
  placeholder?: string
  editable?: boolean
  minHeight?: string
}

interface RichTextComponentProps {
  element: EditorElement
}

const RichTextComponent: React.FC<RichTextComponentProps> = ({ element }) => {
  const { dispatch, state } = useEditor()
  const content = element.content as RichTextContent | undefined
  const [htmlContent, setHtmlContent] = useState(content?.content || '')

  const handleContentChange = (newContent: string) => {
    setHtmlContent(newContent)

    // Update the element content in the editor state
    dispatch({
      type: 'UPDATE_ELEMENT',
      payload: {
        elementDetails: {
          ...element,
          content: {
            ...content,
            content: newContent,
          } as any,
        },
      },
    })
  }

  const containerStyles = {
    minHeight: content?.minHeight || '200px',
    padding: '10px',
    border: state.editor.liveMode ? 'none' : '1px dashed #e5e5e5',
    borderRadius: '8px',
  }

  // Simple rich text editor implementation
  // In production, this would use the minimal-tiptap component from shadcn MCP
  return (
    <BaseFunnelComponent element={element} className="w-full">
      <div style={containerStyles}>
        {state.editor.liveMode ? (
          // Display mode - render HTML content
          <div
            className="prose prose-sm max-w-none"
            dangerouslySetInnerHTML={{ __html: htmlContent }}
          />
        ) : (
          // Edit mode - simple textarea for now
          // TODO: Replace with shadcn minimal-tiptap component
          <div className="space-y-2">
            <div className="text-xs font-medium text-gray-500">
              Rich Text Editor (Preview Mode)
            </div>
            <textarea
              value={htmlContent}
              onChange={e => handleContentChange(e.target.value)}
              placeholder={content?.placeholder || 'Start typing...'}
              className="min-h-[150px] w-full resize-none rounded-md border border-gray-200 p-3 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <div className="text-xs text-gray-400">
              Note: Full rich text editor with toolbar will be implemented using
              shadcn minimal-tiptap
            </div>
          </div>
        )}
      </div>
    </BaseFunnelComponent>
  )
}

export default RichTextComponent
