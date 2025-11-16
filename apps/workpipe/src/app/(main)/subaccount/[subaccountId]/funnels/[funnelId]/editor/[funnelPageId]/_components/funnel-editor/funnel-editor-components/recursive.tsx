import {
  HeadingComponent,
  AnimatedTextComponent,
  RichTextComponent,
  IconComponent,
  DividerComponent,
  SpacerComponent,
  CodeBlockComponent,
  QRCodeComponent,
} from '@/components/funnel-builder/content'
import { EditorElement } from '@/providers/editor/editor-provider'

import Checkout from './checkout'
import ContactFormComponent from './contact-form-component'
import Container from './container'
import LinkComponent from './link-component'
import TextComponent from './text'
import VideoComponent from './video'
// Import new content components

type Props = {
  element: EditorElement
}

const Recursive = ({ element }: Props) => {
  switch (element.type) {
    // Existing components
    case 'text':
      return <TextComponent element={element} />
    case 'container':
      return <Container element={element} />
    case 'video':
      return <VideoComponent element={element} />
    case 'contactForm':
      return <ContactFormComponent element={element} />
    case 'paymentForm':
      return <Checkout element={element} />
    case '2Col':
      return <Container element={element} />
    case '__body':
      return <Container element={element} />
    case 'link':
      return <LinkComponent element={element} />

    // New content components
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

    default:
      return null
  }
}

export default Recursive
