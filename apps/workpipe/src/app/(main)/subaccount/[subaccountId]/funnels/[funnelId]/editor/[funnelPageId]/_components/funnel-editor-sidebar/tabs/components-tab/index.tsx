import React from 'react'

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion'
import { EditorBtns } from '@/lib/constants'

import AnimatedTextPlaceholder from './animated-text-placeholder'
import ButtonPlaceholder from './button-placeholder'
import CheckoutPlaceholder from './checkout-placeholder'
import CodeBlockPlaceholder from './code-block-placeholder'
import ContactFormComponentPlaceholder from './contact-form-placeholder'
import ContainerPlaceholder from './container-placeholder'
import DividerPlaceholder from './divider-placeholder'
import HeadingPlaceholder from './heading-placeholder'
import IconPlaceholder from './icon-placeholder'
import ImagePlaceholder from './image-placeholder'
import LinkPlaceholder from './link-placeholder'
import QRCodePlaceholder from './qr-code-placeholder'
import RichTextPlaceholder from './rich-text-placeholder'
import SpacerPlaceholder from './spacer-placeholder'
import TextPlaceholder from './text-placeholder'
import ThreeColumnsPlaceholder from './three-columns-placeholder'
import TwoColumnsPlaceholder from './two-columns-placeholder'
import VideoPlaceholder from './video-placeholder'

type Props = Record<string, never>

const ComponentsTab = (props: Props) => {
  const elements: {
    Component: React.ReactNode
    label: string
    id: EditorBtns
    group: 'layout' | 'elements' | 'content'
  }[] = [
    // Existing Elements
    {
      Component: <TextPlaceholder />,
      label: 'Text',
      id: 'text',
      group: 'elements',
    },
    {
      Component: <ContainerPlaceholder />,
      label: 'Container',
      id: 'container',
      group: 'layout',
    },
    {
      Component: <TwoColumnsPlaceholder />,
      label: '2 Columns',
      id: '2Col',
      group: 'layout',
    },
    {
      Component: <ThreeColumnsPlaceholder />,
      label: '3 Columns',
      id: '3Col',
      group: 'layout',
    },
    {
      Component: <VideoPlaceholder />,
      label: 'Video',
      id: 'video',
      group: 'elements',
    },
    {
      Component: <ImagePlaceholder />,
      label: 'Image',
      id: 'image',
      group: 'elements',
    },
    {
      Component: <ButtonPlaceholder />,
      label: 'Button',
      id: 'button',
      group: 'elements',
    },
    {
      Component: <ContactFormComponentPlaceholder />,
      label: 'Contact',
      id: 'contactForm',
      group: 'elements',
    },
    {
      Component: <CheckoutPlaceholder />,
      label: 'Checkout',
      id: 'paymentForm',
      group: 'elements',
    },
    {
      Component: <LinkPlaceholder />,
      label: 'Link',
      id: 'link',
      group: 'elements',
    },
    // New Content Components
    {
      Component: <HeadingPlaceholder />,
      label: 'Heading',
      id: 'heading',
      group: 'content',
    },
    {
      Component: <AnimatedTextPlaceholder />,
      label: 'Animated Text',
      id: 'animated-text',
      group: 'content',
    },
    {
      Component: <RichTextPlaceholder />,
      label: 'Rich Text',
      id: 'rich-text',
      group: 'content',
    },
    {
      Component: <IconPlaceholder />,
      label: 'Icon',
      id: 'icon',
      group: 'content',
    },
    {
      Component: <DividerPlaceholder />,
      label: 'Divider',
      id: 'divider',
      group: 'content',
    },
    {
      Component: <SpacerPlaceholder />,
      label: 'Spacer',
      id: 'spacer',
      group: 'content',
    },
    {
      Component: <CodeBlockPlaceholder />,
      label: 'Code Block',
      id: 'code-block',
      group: 'content',
    },
    {
      Component: <QRCodePlaceholder />,
      label: 'QR Code',
      id: 'qr-code',
      group: 'content',
    },
  ]

  return (
    <Accordion
      type="multiple"
      className="w-full"
      defaultValue={['Layout', 'Elements', 'Content']}
    >
      <AccordionItem value="Layout" className="border-y-[1px] px-6 py-0">
        <AccordionTrigger className="!no-underline">Layout</AccordionTrigger>
        <AccordionContent className="flex flex-wrap gap-2">
          {elements
            .filter(element => element.group === 'layout')
            .map(element => (
              <div
                key={element.id}
                className="flex flex-col items-center justify-center"
              >
                {element.Component}
                <span className="text-xs text-muted-foreground">
                  {element.label}
                </span>
              </div>
            ))}
        </AccordionContent>
      </AccordionItem>
      <AccordionItem value="Elements" className="px-6 py-0">
        <AccordionTrigger className="!no-underline">Elements</AccordionTrigger>
        <AccordionContent className="flex flex-wrap gap-2">
          {elements
            .filter(element => element.group === 'elements')
            .map(element => (
              <div
                key={element.id}
                className="flex flex-col items-center justify-center"
              >
                {element.Component}
                <span className="text-xs text-muted-foreground">
                  {element.label}
                </span>
              </div>
            ))}
        </AccordionContent>
      </AccordionItem>
      <AccordionItem value="Content" className="border-y-[1px] px-6 py-0">
        <AccordionTrigger className="!no-underline">
          Content (shadcn)
        </AccordionTrigger>
        <AccordionContent className="flex flex-wrap gap-2">
          {elements
            .filter(element => element.group === 'content')
            .map(element => (
              <div
                key={element.id}
                className="flex flex-col items-center justify-center"
              >
                {element.Component}
                <span className="text-xs text-muted-foreground">
                  {element.label}
                </span>
              </div>
            ))}
        </AccordionContent>
      </AccordionItem>
    </Accordion>
  )
}

export default ComponentsTab
