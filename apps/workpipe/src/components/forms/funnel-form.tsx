'use client'
import React, { useEffect } from 'react'

import { zodResolver } from '@hookform/resolvers/zod'
import { Funnel } from '@prisma/client'
import { useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { v4 } from 'uuid'
import { z } from 'zod'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import {
  deleteFunnel,
  saveActivityLogsNotification,
  upsertFunnel,
} from '@/lib/queries'
import { CreateFunnelFormSchema } from '@/lib/types'
import { useModal } from '@/providers/modal-provider'

import FileUpload from '../global/file-upload'
import Loading from '../global/loading'
import { Button } from '../ui/button'
import { Input } from '../ui/input'
import { Textarea } from '../ui/textarea'
import { toast } from '../ui/use-toast'

interface CreateFunnelProps {
  defaultData?: Funnel
  subAccountId: string
}

//CHALLENGE: Use favicons

const FunnelForm: React.FC<CreateFunnelProps> = ({
  defaultData,
  subAccountId,
}) => {
  const { setClose } = useModal()
  const router = useRouter()
  const form = useForm<z.infer<typeof CreateFunnelFormSchema>>({
    mode: 'onChange',
    resolver: zodResolver(CreateFunnelFormSchema),
    defaultValues: {
      name: defaultData?.name || '',
      description: defaultData?.description || '',
      favicon: defaultData?.favicon || '',
      subDomainName: defaultData?.subDomainName || '',
    },
  })

  useEffect(() => {
    if (defaultData) {
      form.reset({
        description: defaultData.description || '',
        favicon: defaultData.favicon || '',
        name: defaultData.name || '',
        subDomainName: defaultData.subDomainName || '',
      })
    }
  }, [defaultData])

  const isLoading = form.formState.isLoading

  const onSubmit = async (values: z.infer<typeof CreateFunnelFormSchema>) => {
    if (!subAccountId) return
    try {
      const response = await upsertFunnel(
        subAccountId,
        { ...values, liveProducts: defaultData?.liveProducts || '[]' },
        defaultData?.id || v4()
      )
      if (response) {
        await saveActivityLogsNotification({
          businessId: undefined,
          description: `Update funnel | ${response.name}`,
          subaccountId: subAccountId,
        })
        toast({
          title: 'Success',
          description: 'Saved funnel details',
        })
        setClose()
        router.refresh()
      } else {
        toast({
          variant: 'destructive',
          title: 'Oops!',
          description: 'Could not save funnel details',
        })
      }
    } catch (error) {
      console.error('Error saving funnel:', error)
      toast({
        variant: 'destructive',
        title: 'Oops!',
        // Surface actionable server messages (e.g. subdomain taken/invalid);
        // fall back to a generic line for anything unexpected.
        description:
          error instanceof Error && error.message
            ? error.message
            : 'Could not save funnel details. Please try again.',
      })
    }
  }

  const [isDeleting, setIsDeleting] = React.useState(false)
  const handleDelete = async () => {
    if (!defaultData?.id) return
    setIsDeleting(true)
    try {
      await deleteFunnel(defaultData.id)
      await saveActivityLogsNotification({
        businessId: undefined,
        description: `Deleted a funnel | ${defaultData.name}`,
        subaccountId: subAccountId,
      })
      toast({ title: 'Deleted', description: 'Funnel deleted' })
      setClose()
      router.push(`/subaccount/${subAccountId}/funnels`)
      router.refresh()
    } catch (error) {
      console.error('Error deleting funnel:', error)
      toast({
        variant: 'destructive',
        title: 'Oops!',
        description: 'Could not delete this funnel. Please try again.',
      })
    } finally {
      setIsDeleting(false)
    }
  }

  return (
    <Card className="flex-1">
      <CardHeader>
        <CardTitle>Funnel Details</CardTitle>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form
            onSubmit={form.handleSubmit(onSubmit)}
            className="flex flex-col gap-4"
          >
            <FormField
              disabled={isLoading}
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Funnel Name</FormLabel>
                  <FormControl>
                    <Input placeholder="Name" {...field} />
                  </FormControl>
                </FormItem>
              )}
            />
            <FormField
              disabled={isLoading}
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Funnel Description</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Tell us a little bit more about this funnel."
                      {...field}
                    />
                  </FormControl>
                </FormItem>
              )}
            />
            <FormField
              disabled={isLoading}
              control={form.control}
              name="subDomainName"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Sub domain</FormLabel>
                  <FormControl>
                    <Input placeholder="Sub domain for funnel" {...field} />
                  </FormControl>
                </FormItem>
              )}
            />
            <FormField
              disabled={isLoading}
              control={form.control}
              name="favicon"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Favicon</FormLabel>
                  <FormControl>
                    <FileUpload
                      apiEndpoint="subaccountLogo"
                      value={field.value}
                      onChange={field.onChange}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <div className="mt-4 flex items-center justify-between gap-4">
              <Button className="w-20" disabled={isLoading} type="submit">
                {form.formState.isSubmitting ? <Loading /> : 'Save'}
              </Button>
              {defaultData?.id && (
                <Button
                  variant="outline"
                  type="button"
                  disabled={isDeleting}
                  className="border-destructive text-destructive hover:bg-destructive"
                  onClick={handleDelete}
                >
                  {isDeleting ? <Loading /> : 'Delete Funnel'}
                </Button>
              )}
            </div>
          </form>
        </Form>
      </CardContent>
    </Card>
  )
}

export default FunnelForm
