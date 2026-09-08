'use client'
import React, { useEffect } from 'react'

import { zodResolver } from '@hookform/resolvers/zod'
import { Contact } from '@prisma/client'
import { useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { z } from 'zod'

import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from '@/components/ui/card'
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import { saveActivityLogsNotification, upsertContact } from '@/lib/queries'
import { ContactUserFormSchema } from '@/lib/types'
import { useModal } from '@/providers/modal-provider'

import Loading from '../global/loading'
import { Button } from '../ui/button'
import { Input } from '../ui/input'
import { Textarea } from '../ui/textarea'
import { toast } from '../ui/use-toast'

interface ContactUserFormProps {
  subaccountId: string
  /** Existing contact when editing; falls back to the modal payload. */
  contact?: Contact
}

const ContactUserForm: React.FC<ContactUserFormProps> = ({
  subaccountId,
  contact,
}) => {
  const { setClose, data } = useModal()
  const router = useRouter()
  // The contact being edited, if any — passed as a prop or via the modal.
  const existingContact = contact ?? data.contact
  const form = useForm<z.infer<typeof ContactUserFormSchema>>({
    mode: 'onChange',
    resolver: zodResolver(ContactUserFormSchema),
    defaultValues: {
      name: '',
      email: '',
      phone: '',
      companyName: '',
      message: '',
    },
  })

  useEffect(() => {
    if (existingContact) {
      // Mapped field by field rather than spread: the Contact row stores the
      // optional columns as null, which the form's string fields reject.
      // `message` lives in customFields, so it starts blank on every edit and
      // is only written when the user actually types one.
      form.reset({
        name: existingContact.name,
        email: existingContact.email,
        phone: existingContact.phone ?? '',
        companyName: existingContact.companyName ?? '',
        message: '',
      })
    }
  }, [existingContact, form.reset])

  const isLoading = form.formState.isLoading

  const handleSubmit = async (
    values: z.infer<typeof ContactUserFormSchema>
  ) => {
    try {
      const response = await upsertContact({
        // Carry the id when editing, otherwise the save would create a
        // second contact instead of updating this one.
        ...(existingContact?.id && { id: existingContact.id }),
        email: values.email,
        subAccountId: subaccountId,
        name: values.name,
        phone: values.phone || undefined,
        companyName: values.companyName || undefined,
        // No `message` column — it rides along in the customFields Json.
        customFields: values.message ? { message: values.message } : undefined,
      })
      await saveActivityLogsNotification({
        businessId: undefined,
        description: `Updated a contact | ${response?.name}`,
        subaccountId: subaccountId,
      })
      toast({
        title: 'Success',
        description: 'Saved funnel details',
      })
      setClose()
      router.refresh()
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Oops!',
        description: 'Could not save contact details',
      })
    }
  }

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle>Contact Info</CardTitle>
        <CardDescription>
          You can assign tickets to contacts and set a value for each contact in
          the ticket.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form
            onSubmit={form.handleSubmit(handleSubmit)}
            className="flex flex-col gap-4"
          >
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
            <FormField
              disabled={isLoading}
              control={form.control}
              name="phone"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Phone</FormLabel>
                  <FormControl>
                    <Input
                      type="tel"
                      placeholder="Phone (optional)"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              disabled={isLoading}
              control={form.control}
              name="companyName"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Company</FormLabel>
                  <FormControl>
                    <Input placeholder="Company (optional)" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              disabled={isLoading}
              control={form.control}
              name="message"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Message</FormLabel>
                  <FormControl>
                    <Textarea placeholder="Message (optional)" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <Button className="mt-4" disabled={isLoading} type="submit">
              {form.formState.isSubmitting ? (
                <Loading />
              ) : (
                'Save Contact Details!'
              )}
            </Button>
          </form>
        </Form>
      </CardContent>
    </Card>
  )
}

export default ContactUserForm
