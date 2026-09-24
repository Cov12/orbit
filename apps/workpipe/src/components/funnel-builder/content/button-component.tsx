'use client'

import React from 'react'

import { EditorElement, useEditor } from '@/providers/editor/editor-provider'

import BaseFunnelComponent from '../base-funnel-component'

interface ButtonContent {
  text: string
  href: string
  target: '_self' | '_blank'
  variant: 'primary' | 'secondary' | 'outline' | 'ghost'
  size: 'sm' | 'md' | 'lg'
  fullWidth: boolean
  borderRadius: string
  backgroundColor: string
  textColor: string
  hoverBackgroundColor: string
  hoverTextColor: string
}

interface ButtonComponentProps {
  element: EditorElement
}

const ButtonComponent: React.FC<ButtonComponentProps> = ({ element }) => {
  const { dispatch, state } = useEditor()
  const content = element.content as ButtonContent

  const getVariantStyles = (): React.CSSProperties => {
    const variant = content?.variant || 'primary'
    const bgColor = content?.backgroundColor
    const textColor = content?.textColor

    switch (variant) {
      case 'primary':
        return {
          backgroundColor: bgColor || '#6366f1',
          color: textColor || '#ffffff',
          border: 'none',
        }
      case 'secondary':
        return {
          backgroundColor: bgColor || '#f1f5f9',
          color: textColor || '#1e293b',
          border: 'none',
        }
      case 'outline':
        return {
          backgroundColor: 'transparent',
          color: textColor || '#6366f1',
          border: `2px solid ${bgColor || '#6366f1'}`,
        }
      case 'ghost':
        return {
          backgroundColor: 'transparent',
          color: textColor || '#6366f1',
          border: 'none',
        }
      default:
        return {
          backgroundColor: bgColor || '#6366f1',
          color: textColor || '#ffffff',
        }
    }
  }

  const getSizeStyles = (): React.CSSProperties => {
    const size = content?.size || 'md'
    switch (size) {
      case 'sm':
        return {
          padding: '8px 16px',
          fontSize: '14px',
        }
      case 'md':
        return {
          padding: '12px 24px',
          fontSize: '16px',
        }
      case 'lg':
        return {
          padding: '16px 32px',
          fontSize: '18px',
        }
      default:
        return {
          padding: '12px 24px',
          fontSize: '16px',
        }
    }
  }

  const buttonStyles: React.CSSProperties = {
    ...getVariantStyles(),
    ...getSizeStyles(),
    borderRadius: content?.borderRadius || '8px',
    fontWeight: 600,
    cursor: 'pointer',
    transition: 'all 0.2s ease-in-out',
    textDecoration: 'none',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: content?.fullWidth ? '100%' : 'auto',
  }

  const handleTextChange = (e: React.FocusEvent<HTMLSpanElement>) => {
    dispatch({
      type: 'UPDATE_ELEMENT',
      payload: {
        elementDetails: {
          ...element,
          content: {
            ...content,
            text: e.target.innerText,
          } as any,
        },
      },
    })
  }

  const handleClick = (e: React.MouseEvent) => {
    // In editor mode, prevent navigation
    if (!state.editor.liveMode) {
      e.preventDefault()
    }
  }

  const ButtonWrapper = state.editor.liveMode && content?.href ? 'a' : 'button'

  return (
    <BaseFunnelComponent element={element} className="inline-block">
      <ButtonWrapper
        href={state.editor.liveMode ? content?.href : undefined}
        target={content?.target || '_self'}
        style={buttonStyles}
        onClick={handleClick}
        className="hover:opacity-90 hover:scale-[1.02] active:scale-[0.98]"
      >
        <span
          contentEditable={!state.editor.liveMode}
          suppressContentEditableWarning={true}
          onBlur={handleTextChange}
          className="outline-none"
        >
          {content?.text || 'Click Me'}
        </span>
      </ButtonWrapper>
    </BaseFunnelComponent>
  )
}

export default ButtonComponent
