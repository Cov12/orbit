import React, { useRef } from 'react'

import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'
import { z } from 'zod'

import { ContactUserFormSchema } from '@/lib/types'

import Loading from '../global/loading'
import { Button } from '../ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '../ui/card'
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '../ui/form'
import { Input } from '../ui/input'

type Props = {
  title: string
  subTitle: string
  /**
   * `honeypot` is whatever ended up in the hidden `website_url` input — empty
   * for a real user, filled by bots that complete every field they find. It is
   * kept out of `ContactUserFormSchema` on purpose so the validated contact
   * shape stays exactly the legitimate fields; the caller forwards it to the
   * ingest endpoint, which decides what to do with it.
   */
  apiCall: (
    values: z.infer<typeof ContactUserFormSchema>,
    honeypot?: string
  ) => any
}

const ContactForm = ({ apiCall, subTitle, title }: Props) => {
  const honeypotRef = useRef<HTMLInputElement>(null)
  const form = useForm<z.infer<typeof ContactUserFormSchema>>({
    mode: 'onChange',
    resolver: zodResolver(ContactUserFormSchema),
    defaultValues: {
      name: '',
      email: '',
    },
  })
  const isLoading = form.formState.isLoading

  //CHALLENGE: We want to create tags for each leads that comes from the form

  return (
    <Card className="w-[500px] max-w-[500px]">
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{subTitle}</CardDescription>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form
            onSubmit={form.handleSubmit(values =>
              apiCall(values, honeypotRef.current?.value)
            )}
            className="flex flex-col gap-4"
          >
            {/* Honeypot: hidden from real users (and from the a11y tree), so
                anything in it came from a bot. Uncontrolled and outside the
                zod schema — read via ref at submit time. */}
            <input
              ref={honeypotRef}
              type="text"
              name="website_url"
              tabIndex={-1}
              autoComplete="off"
              aria-hidden="true"
              style={{
                position: 'absolute',
                width: '1px',
                height: '1px',
                padding: 0,
                margin: '-1px',
                overflow: 'hidden',
                clip: 'rect(0, 0, 0, 0)',
                whiteSpace: 'nowrap',
                border: 0,
              }}
            />
            <FormField
              disabled={isLoading}
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Name</FormLabel>
                  <FormControl>
                    <Input placeholder="Name" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              disabled={isLoading}
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Email</FormLabel>
                  <FormControl>
                    <Input type="email" placeholder="Email" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <Button className="mt-4" disabled={isLoading} type="submit">
              {form.formState.isSubmitting ? <Loading /> : 'Get a free quote!'}
            </Button>
          </form>
        </Form>
      </CardContent>
    </Card>
  )
}

export default ContactForm
