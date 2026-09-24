'use client'

import React from 'react'

import ContactFormComponent from '@/app/(main)/subaccount/[subaccountId]/funnels/[funnelId]/editor/[funnelPageId]/_components/funnel-editor/funnel-editor-components/contact-form-component'
import LinkComponent from '@/app/(main)/subaccount/[subaccountId]/funnels/[funnelId]/editor/[funnelPageId]/_components/funnel-editor/funnel-editor-components/link-component'
import { EditorElement } from '@/providers/editor/editor-provider'

import {
  HeadingComponent,
  AnimatedTextComponent,
  RichTextComponent,
  IconComponent,
  DividerComponent,
  SpacerComponent,
  CodeBlockComponent,
  QRCodeComponent,
} from './content'

interface ComponentRendererProps {
  element: EditorElement
}

/**
 * Central component registry for all funnel builder components
 * Maps component types to their respective React components
 * Uses shadcn MCP components where applicable
 */
export const ComponentRegistry: React.FC<ComponentRendererProps> = ({
  element,
}) => {
  const renderComponent = () => {
    switch (element.type) {
      // Content Components
      case 'heading':
        return <HeadingComponent element={element} />
      case 'animated-text':
        return <AnimatedTextComponent element={element} />
      case 'rich-text':
        return <RichTextComponent element={element} />
      case 'icon':
        return <IconComponent element={element} />
      case 'divider':
        return <DividerComponent element={element} />
      case 'spacer':
        return <SpacerComponent element={element} />
      case 'code-block':
        return <CodeBlockComponent element={element} />
      case 'qr-code':
        return <QRCodeComponent element={element} />

      // Existing Components (maintained for compatibility)
      case 'text':
        return <TextComponent element={element} />
      case 'container':
        return <Container element={element} />
      case 'section':
        return <Container element={element} />
      case '2Col':
        return <TwoColumns element={element} />
      case '3Col':
        return <ThreeColumns element={element} />
      case 'contactForm':
        return <ContactFormComponent element={element} />
      case 'paymentForm':
        return <CheckoutComponent element={element} />
      case 'link':
        return <LinkComponent element={element} />
      case 'video':
        return <VideoComponent element={element} />
      case 'image':
        return <ImageComponent element={element} />

      // Form Components (placeholder - to be implemented)
      case 'newsletter':
        return (
          <PlaceholderComponent element={element} name="Newsletter Signup" />
        )
      case 'survey':
        return <PlaceholderComponent element={element} name="Survey/Quiz" />
      case 'file-upload':
        return <PlaceholderComponent element={element} name="File Upload" />
      case 'date-picker':
        return <PlaceholderComponent element={element} name="Date Picker" />
      case 'phone-input':
        return <PlaceholderComponent element={element} name="Phone Input" />

      // Interactive Components (placeholder - to be implemented)
      case 'button':
        return <PlaceholderComponent element={element} name="Button" />
      case 'tabs':
        return <PlaceholderComponent element={element} name="Tabs" />
      case 'accordion':
        return <PlaceholderComponent element={element} name="Accordion" />
      case 'modal':
        return <PlaceholderComponent element={element} name="Modal/Dialog" />
      case 'tooltip':
        return <PlaceholderComponent element={element} name="Tooltip" />
      case 'dropdown':
        return <PlaceholderComponent element={element} name="Dropdown Menu" />

      // Media Components (placeholder - to be implemented)
      case 'image-gallery':
        return <PlaceholderComponent element={element} name="Image Gallery" />
      case 'image-carousel':
        return <PlaceholderComponent element={element} name="Image Carousel" />
      case 'audio-player':
        return <PlaceholderComponent element={element} name="Audio Player" />

      // E-commerce Components (placeholder - to be implemented)
      case 'product-card':
        return <PlaceholderComponent element={element} name="Product Card" />
      case 'price-table':
        return <PlaceholderComponent element={element} name="Price Table" />
      case 'rating':
        return <PlaceholderComponent element={element} name="Rating" />

      // Layout Components (placeholder - to be implemented)
      case 'card':
        return <PlaceholderComponent element={element} name="Card" />

      // Navigation Components (placeholder - to be implemented)
      case 'navbar':
        return <PlaceholderComponent element={element} name="Navigation Bar" />
      case 'breadcrumbs':
        return <PlaceholderComponent element={element} name="Breadcrumbs" />
      case 'pagination':
        return <PlaceholderComponent element={element} name="Pagination" />

      // Social Proof Components (placeholder - to be implemented)
      case 'testimonial':
        return <PlaceholderComponent element={element} name="Testimonial" />
      case 'logo-grid':
        return <PlaceholderComponent element={element} name="Logo Grid" />

      // Analytics Components (placeholder - to be implemented)
      case 'pixel':
        return (
          <PlaceholderComponent element={element} name="Conversion Pixel" />
        )

      // Animation Components (placeholder - to be implemented)
      case 'counter':
        return (
          <PlaceholderComponent element={element} name="Animated Counter" />
        )
      case 'particles':
        return (
          <PlaceholderComponent element={element} name="Particle Effects" />
        )
      case 'bg-animation':
        return (
          <PlaceholderComponent element={element} name="Background Animation" />
        )

      // Business Components (placeholder - to be implemented)
      case 'appointment':
        return (
          <PlaceholderComponent element={element} name="Appointment Booking" />
        )
      case 'lead-magnet':
        return <PlaceholderComponent element={element} name="Lead Magnet" />

      default:
        return (
          <PlaceholderComponent
            element={element}
            name={`Unknown Component (${element.type})`}
          />
        )
    }
  }

  return renderComponent()
}

// Placeholder component for components not yet implemented
const PlaceholderComponent: React.FC<{
  element: EditorElement
  name: string
}> = ({ element, name }) => {
  return (
    <div
      className="w-full rounded-lg border-2 border-dashed border-gray-300 bg-gray-50 p-4 text-center"
      style={element.styles}
    >
      <div className="font-medium text-gray-600">{name}</div>
      <div className="mt-1 text-xs text-gray-400">
        Component implementation pending
      </div>
      <div className="text-xs text-gray-400">
        Will use shadcn MCP components
      </div>
    </div>
  )
}

// These components need to be imported from the existing editor implementation
// Placeholder implementations for now
const TextComponent: React.FC<{ element: EditorElement }> = ({ element }) => (
  <PlaceholderComponent element={element} name="Text Component (Existing)" />
)

const Container: React.FC<{ element: EditorElement }> = ({ element }) => (
  <PlaceholderComponent element={element} name="Container (Existing)" />
)

const TwoColumns: React.FC<{ element: EditorElement }> = ({ element }) => (
  <PlaceholderComponent element={element} name="2 Columns (Existing)" />
)

const ThreeColumns: React.FC<{ element: EditorElement }> = ({ element }) => (
  <PlaceholderComponent element={element} name="3 Columns (Existing)" />
)

const CheckoutComponent: React.FC<{ element: EditorElement }> = ({
  element,
}) => <PlaceholderComponent element={element} name="Checkout (Existing)" />

const VideoComponent: React.FC<{ element: EditorElement }> = ({ element }) => (
  <PlaceholderComponent element={element} name="Video (Existing)" />
)

const ImageComponent: React.FC<{ element: EditorElement }> = ({ element }) => (
  <PlaceholderComponent element={element} name="Image (Existing)" />
)

export default ComponentRegistry
