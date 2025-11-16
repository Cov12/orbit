'use client'

import React from 'react'

import { EditorElement, useEditor } from '@/providers/editor/editor-provider'

import BaseFunnelComponent from '../base-funnel-component'

// Using shadcn MCP components for text animations
interface AnimatedTextContent {
  text: string
  animation: 'typing' | 'generate' | 'rolling' | 'splitting'
  speed: number
  color?: string
  fontSize?: string
}

interface AnimatedTextComponentProps {
  element: EditorElement
}

const AnimatedTextComponent: React.FC<AnimatedTextComponentProps> = ({ element }) => {
  const { dispatch, state } = useEditor()
  const content = element.content as AnimatedTextContent

  const textStyles = {
    color: content?.color || '#000000',
    fontSize: content?.fontSize || '1.5rem',
    padding: '10px',
  }

  const handleBlur = (e: React.FocusEvent<HTMLDivElement>) => {
    const textElement = e.target as HTMLDivElement
    dispatch({
      type: 'UPDATE_ELEMENT',
      payload: {
        elementDetails: {
          ...element,
          content: {
            ...content,
            text: textElement.innerText,
          },
        },
      },
    })
  }

  const renderAnimatedText = () => {
    const text = content?.text || 'Animated Text Here'

    // When in edit mode, show simple editable text
    if (!state.editor.liveMode) {
      return (
        <div
          style={textStyles}
          contentEditable={true}
          onBlur={handleBlur}
          suppressContentEditableWarning={true}
        >
          {text}
        </div>
      )
    }

    // In live mode, show animation
    switch (content?.animation) {
      case 'typing':
        // For typing animation - we'll implement a simple version here
        // In production, use the shadcn typing-text component
        return (
          <div style={textStyles} className="typing-animation">
            {text}
          </div>
        )

      case 'generate':
        // For text generate effect - we'll implement a simple version here
        // In production, use the shadcn text-generate-effect component
        return (
          <div style={textStyles} className="generate-animation">
            {text.split(' ').map((word, idx) => (
              <span
                key={idx}
                className="inline-block opacity-0 animate-fade-in"
                style={{ animationDelay: `${idx * 0.1}s` }}
              >
                {word}{' '}
              </span>
            ))}
          </div>
        )

      case 'rolling':
        return (
          <div style={textStyles} className="rolling-animation">
            {text}
          </div>
        )

      case 'splitting':
        return (
          <div style={textStyles} className="splitting-animation">
            {text.split('').map((char, idx) => (
              <span
                key={idx}
                className="inline-block animate-bounce"
                style={{ animationDelay: `${idx * 0.05}s` }}
              >
                {char}
              </span>
            ))}
          </div>
        )

      default:
        return <div style={textStyles}>{text}</div>
    }
  }

  return (
    <BaseFunnelComponent element={element} className="w-full">
      {renderAnimatedText()}
    </BaseFunnelComponent>
  )
}

export default AnimatedTextComponent