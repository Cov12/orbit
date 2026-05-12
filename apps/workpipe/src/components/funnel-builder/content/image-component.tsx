'use client'

import React from 'react'

import { ImageIcon } from 'lucide-react'

import { EditorElement, useEditor } from '@/providers/editor/editor-provider'

import BaseFunnelComponent from '../base-funnel-component'

interface ImageContent {
  src: string
  alt: string
  href: string
  target: '_self' | '_blank'
  objectFit: 'cover' | 'contain' | 'fill' | 'none'
  borderRadius: string
  width: string
  height: string
  aspectRatio: string
}

interface ImageComponentProps {
  element: EditorElement
}

const ImageComponent: React.FC<ImageComponentProps> = ({ element }) => {
  const { dispatch, state } = useEditor()
  const content = element.content as ImageContent

  const imageStyles: React.CSSProperties = {
    width: content?.width || '100%',
    height: content?.height || 'auto',
    objectFit: content?.objectFit || 'cover',
    borderRadius: content?.borderRadius || '0px',
    aspectRatio: content?.aspectRatio || 'auto',
    display: 'block',
  }

  const handleClick = (e: React.MouseEvent) => {
    if (!state.editor.liveMode) {
      e.preventDefault()
    }
  }

  const hasImage = content?.src && content.src.trim() !== ''

  const ImageElement = (
    <>
      {hasImage ? (
        <img
          src={content.src}
          alt={content?.alt || 'Image'}
          style={imageStyles}
          className="transition-all duration-200"
        />
      ) : (
        <div
          style={{
            ...imageStyles,
            minHeight: '150px',
            backgroundColor: '#f1f5f9',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '8px',
            color: '#94a3b8',
          }}
        >
          <ImageIcon size={48} />
          <span className="text-sm">Click to add image URL in settings</span>
        </div>
      )}
    </>
  )

  // Wrap in link if href is provided and in live mode
  if (state.editor.liveMode && content?.href) {
    return (
      <BaseFunnelComponent element={element}>
        <a
          href={content.href}
          target={content?.target || '_self'}
          onClick={handleClick}
          className="block"
        >
          {ImageElement}
        </a>
      </BaseFunnelComponent>
    )
  }

  return (
    <BaseFunnelComponent element={element}>
      {ImageElement}
    </BaseFunnelComponent>
  )
}

export default ImageComponent
