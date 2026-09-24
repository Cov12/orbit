'use client'
import React from 'react'

import clsx from 'clsx'
import { Trash } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { z } from 'zod'

import ContactForm from '@/components/forms/contact-form'
import { Badge } from '@/components/ui/badge'
import { toast } from '@/components/ui/use-toast'
import { EditorBtns } from '@/lib/constants'
import {
  getFunnelPublic,
  saveActivityLogsNotification,
  upsertContactUnchecked,
} from '@/lib/queries'
import { ContactUserFormSchema } from '@/lib/types'
import { EditorElement, useEditor } from '@/providers/editor/editor-provider'

type Props = {
  element: EditorElement
}

const ContactFormComponent = (props: Props) => {
  const { dispatch, state, subaccountId, funnelId, pageDetails, leadFormKey } =
    useEditor()
  const router = useRouter()

  const handleDragStart = (e: React.DragEvent, type: EditorBtns) => {
    if (type === null) return
    e.dataTransfer.setData('componentType', type)
  }

  const handleOnClickBody = (e: React.MouseEvent) => {
    e.stopPropagation()
    dispatch({
      type: 'CHANGE_CLICKED_ELEMENT',
      payload: {
        elementDetails: props.element,
      },
    })
  }

  const styles = props.element.styles

  // Pages saved before the form became configurable still carry `content: []`;
  // treat those (and anything else non-object) as "no config" so every value
  // below falls back to the defaults the form used to hardcode.
  const c =
    props.element.content && !Array.isArray(props.element.content)
      ? props.element.content
      : {}

  const goToNextPage = async () => {
    if (!state.editor.liveMode) return
    const funnelPages = await getFunnelPublic(funnelId)
    if (!funnelPages || !pageDetails) return
    if (funnelPages.FunnelPages.length > pageDetails.order + 1) {
      const nextPage = funnelPages.FunnelPages.find(
        page => page.order === pageDetails.order + 1
      )
      if (!nextPage) return
      router.replace(
        `${process.env.NEXT_PUBLIC_SCHEME}${funnelPages.subDomainName}.${process.env.NEXT_PUBLIC_DOMAIN}/${nextPage.pathName}`
      )
    }
  }

  const handleDeleteElement = () => {
    dispatch({
      type: 'DELETE_ELEMENT',
      payload: { elementDetails: props.element },
    })
  }

  const onFormSubmit = async (
    values: z.infer<typeof ContactUserFormSchema>,
    honeypot?: string
  ) => {
    if (!state.editor.liveMode) return

    // Read attribution inside the handler, not at render — `window` and
    // `document` do not exist while this component is server-rendered.
    const sp = new URLSearchParams(window.location.search)
    const utm = {
      source: sp.get('utm_source') || undefined,
      medium: sp.get('utm_medium') || undefined,
      campaign: sp.get('utm_campaign') || undefined,
      term: sp.get('utm_term') || undefined,
      content: sp.get('utm_content') || undefined,
    }
    const referrerUrl = document.referrer || undefined
    const landingPageUrl = window.location.href

    try {
      if (leadFormKey) {
        // Public ingest path (issue #54 phase 4a): the endpoint resolves the
        // sub-account from the form key, so nothing here is trusted.
        const res = await fetch(`/api/forms/${leadFormKey}/submit`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: values.name,
            email: values.email,
            phone: values.phone || undefined,
            companyName: values.companyName || undefined,
            // No `message` column — the endpoint stores it in customFields.
            customFields: values.message
              ? { message: values.message }
              : undefined,
            utm,
            referrerUrl,
            landingPageUrl,
            website_url: honeypot,
          }),
        })
        const data = await res.json()

        if (!res.ok) {
          toast({
            variant: 'destructive',
            title: 'Failed',
            description: 'Could not save your information',
          })
          return
        }

        toast({
          title: 'Success',
          description: 'Successfully Saved your info',
        })
        await saveActivityLogsNotification({
          businessId: undefined,
          description: `A New contact signed up | ${values.name}`,
          subaccountId: subaccountId,
        })

        // A form-level redirect wins over the funnel's next page.
        if (data?.redirectUrl) {
          router.replace(data.redirectUrl)
        } else {
          await goToNextPage()
        }
        return
      }

      // Provisioning failed (leadFormKey is null) — keep the funnel form
      // working via the legacy direct contact write.
      const response = await upsertContactUnchecked({
        name: values.name,
        email: values.email,
        phone: values.phone || undefined,
        companyName: values.companyName || undefined,
        customFields: values.message ? { message: values.message } : undefined,
        subAccountId: subaccountId,
      })
      //WIP Call trigger endpoint
      await saveActivityLogsNotification({
        businessId: undefined,
        description: `A New contact signed up | ${response?.name}`,
        subaccountId: subaccountId,
      })
      toast({
        title: 'Success',
        description: 'Successfully Saved your info',
      })
      await goToNextPage()
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Failed',
        description: 'Could not save your information',
      })
    }
  }

  return (
    <div
      style={styles}
      draggable
      onDragStart={e => handleDragStart(e, 'contactForm')}
      onClick={handleOnClickBody}
      className={clsx(
        'relative m-[5px] flex w-full items-center justify-center p-[2px] text-[16px] transition-all',
        {
          '!border-blue-500':
            state.editor.selectedElement.id === props.element.id,

          '!border-solid': state.editor.selectedElement.id === props.element.id,
          'border-[1px] border-dashed border-slate-300': !state.editor.liveMode,
        }
      )}
    >
      {state.editor.selectedElement.id === props.element.id &&
        !state.editor.liveMode && (
          <Badge className="absolute -left-[1px] -top-[23px] rounded-none rounded-t-lg">
            {state.editor.selectedElement.name}
          </Badge>
        )}
      <ContactForm
        subTitle={c.subTitle ?? 'Contact Us'}
        title={c.title ?? 'Want a free quote? We can help you'}
        submitText={c.submitText ?? 'Get a free quote!'}
        optionalFields={Array.isArray(c.fields) ? c.fields : undefined}
        apiCall={onFormSubmit}
      />
      {state.editor.selectedElement.id === props.element.id &&
        !state.editor.liveMode && (
          <div className="absolute -right-[1px] -top-[25px] rounded-none rounded-t-lg bg-primary px-2.5 py-1 text-xs font-bold !text-white">
            <Trash
              className="cursor-pointer"
              size={16}
              onClick={handleDeleteElement}
            />
          </div>
        )}
    </div>
  )
}

export default ContactFormComponent
