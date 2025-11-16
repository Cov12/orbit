'use client'

import React from 'react'

import { EditorElement, useEditor } from '@/providers/editor/editor-provider'

import BaseFunnelComponent from '../base-funnel-component'

interface CodeBlockContent {
  code: string
  language: string
  theme: 'light' | 'dark'
  showLineNumbers?: boolean
}

interface CodeBlockComponentProps {
  element: EditorElement
}

const CodeBlockComponent: React.FC<CodeBlockComponentProps> = ({ element }) => {
  const { state } = useEditor()
  const content = element.content as CodeBlockContent

  const codeBlockStyles = {
    padding: '10px',
    fontFamily: 'monospace',
    fontSize: '14px',
    backgroundColor: content?.theme === 'dark' ? '#1e1e1e' : '#f8f9fa',
    color: content?.theme === 'dark' ? '#ffffff' : '#333333',
    border: `1px solid ${content?.theme === 'dark' ? '#333333' : '#e5e5e5'}`,
    borderRadius: '8px',
    overflow: 'auto',
    whiteSpace: 'pre-wrap' as const,
  }

  const languageTagStyles = {
    position: 'absolute' as const,
    top: '5px',
    right: '5px',
    backgroundColor: content?.theme === 'dark' ? '#333333' : '#e5e5e5',
    color: content?.theme === 'dark' ? '#ffffff' : '#666666',
    padding: '2px 8px',
    borderRadius: '4px',
    fontSize: '10px',
    textTransform: 'uppercase' as const,
  }

  return (
    <BaseFunnelComponent element={element} className="w-full">
      <div className="relative">
        <pre style={codeBlockStyles}>
          <code>
            {content?.code || '// Your code here\nconsole.log("Hello, World!");'}
          </code>
        </pre>
        <div style={languageTagStyles}>
          {content?.language || 'javascript'}
        </div>
        {!state.editor.liveMode && (
          <div className="mt-2 text-xs text-gray-500">
            Note: Full syntax highlighting will be implemented using shadcn code-block component
          </div>
        )}
      </div>
    </BaseFunnelComponent>
  )
}

export default CodeBlockComponent