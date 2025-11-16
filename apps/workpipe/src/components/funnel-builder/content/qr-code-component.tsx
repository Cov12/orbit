'use client'

import React from 'react'

import { EditorElement } from '@/providers/editor/editor-provider'

import BaseFunnelComponent from '../base-funnel-component'

interface QRCodeContent {
  value: string
  size: number
  backgroundColor: string
  foregroundColor: string
}

interface QRCodeComponentProps {
  element: EditorElement
}

const QRCodeComponent: React.FC<QRCodeComponentProps> = ({ element }) => {
  const content = element.content as QRCodeContent

  const qrCodeStyles = {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '10px',
  }

  const placeholderStyles = {
    width: content?.size || 200,
    height: content?.size || 200,
    backgroundColor: content?.backgroundColor || '#ffffff',
    border: `2px solid ${content?.foregroundColor || '#000000'}`,
    borderRadius: '8px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '12px',
    color: content?.foregroundColor || '#000000',
    textAlign: 'center' as const,
    padding: '10px',
  }

  return (
    <BaseFunnelComponent element={element} className="w-fit">
      <div style={qrCodeStyles}>
        {/* Placeholder for QR Code - will be replaced with shadcn qr-code component */}
        <div style={placeholderStyles}>
          <div>
            <div style={{ fontWeight: 'bold', marginBottom: '8px' }}>QR Code</div>
            <div style={{ fontSize: '10px', opacity: 0.7 }}>
              {content?.value || 'https://example.com'}
            </div>
            <div style={{ fontSize: '8px', marginTop: '8px', opacity: 0.5 }}>
              Will render with shadcn QR component
            </div>
          </div>
        </div>
      </div>
    </BaseFunnelComponent>
  )
}

export default QRCodeComponent