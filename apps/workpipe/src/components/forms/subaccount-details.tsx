'use client'

import { useEffect } from 'react'

import { zodResolver } from '@hookform/resolvers/zod'
import { Business, SubAccount } from '@prisma/client'
import { useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import * as z from 'zod'

import { Button } from '@/components/ui/button'
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
import { Input } from '@/components/ui/input'
import {
  mintPortalSubAccountId,
  saveActivityLogsNotification,
  upsertSubAccount,
} from '@/lib/queries'
import { useModal } from '@/providers/modal-provider'

import FileUpload from '../global/file-upload'
import Loading from '../global/loading'
import { useToast } from '../ui/use-toast'

const formSchema = z.object({
  name: z.string(),
  companyEmail: z.string(),
  companyPhone: z.string().min(1),
  address: z.string(),
  city: z.string(),
  subAccountLogo: z.string(),
  zipCode: z.string(),
  state: z.string(),
  country: z.string(),
})

//Cleanup
//To Do: Give access for Subaccount Guest they should see a different view maybe a form that allows them to create tickets

//Cleanup
//To Do: layout.tsx oonly runs once as a result if you remove permissions for someone and they keep navigating the layout.tsx wont fire again. solution- save the data inside metadata for current user.

interface SubAccountDetailsProps {
  //To add the sub account to the business
  businessDetails: Business
  details?: Partial<SubAccount>
  userId: string
  userName: string
}

const SubAccountDetails: React.FC<SubAccountDetailsProps> = ({
  details,
  businessDetails,
  userId,
  userName,
}) => {
  const { toast } = useToast()
  const { setClose } = useModal()
  const router = useRouter()
  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: details?.name || '',
      companyEmail: details?.companyEmail || '',
      companyPhone: details?.companyPhone || '',
      address: details?.address || '',
      city: details?.city || '',
      zipCode: details?.zipCode || '',
      state: details?.state || '',
      country: details?.country || '',
      subAccountLogo: details?.subAccountLogo || '',
    },
  })

  async function onSubmit() {
    const values = form.getValues()
    // Same empty/partial-submit guard as user-details: if RHF hands back blank
    // fields, fall back to the sub-account record we loaded so required fields
    // (notably companyEmail, which upsertSubAccount rejects when missing) are
    // never lost. The log line confirms what the form actually submitted.
    console.log('[subaccount-details] submit values:', values)
    try {
      // New sub-accounts get their canonical id from Portal (the ecosystem's
      // source of truth for sub-account identity), so WorkPipe/Drive/Conductor all
      // share one id. Editing keeps the existing id.
      const subAccountId = details?.id
        ? details.id
        : await mintPortalSubAccountId(values.name || details?.name || '')

      const response = await upsertSubAccount({
        id: subAccountId,
        address: values.address || details?.address || '',
        subAccountLogo: values.subAccountLogo || details?.subAccountLogo || '',
        city: values.city || details?.city || '',
        companyPhone: values.companyPhone || details?.companyPhone || '',
        country: values.country || details?.country || '',
        name: values.name || details?.name || '',
        state: values.state || details?.state || '',
        zipCode: values.zipCode || details?.zipCode || '',
        createdAt: details?.createdAt || new Date(),
        updatedAt: new Date(),
        companyEmail: values.companyEmail || details?.companyEmail || '',
        businessId: businessDetails.id,
        connectAccountId: details?.connectAccountId || '',
        goal: details?.goal ?? 5000,
      })
      if (!response) {
        // upsertSubAccount's contract: it returns `null` ONLY when it bailed on a
        // guard (missing companyEmail / no BUSINESS_OWNER) — and it already logged
        // the reason server-side. Any non-null return means the write succeeded.
        // Check for null, NOT `response.id`: keying off `.id` falsely errored on
        // saves that actually persisted whenever the serialized return wasn't a
        // full record.
        throw new Error(
          'Could not save — the sub account is missing a company email or business owner.'
        )
      }

      // The activity-log notification is a non-critical side effect; never let
      // it abort a save that already succeeded.
      try {
        await saveActivityLogsNotification({
          businessId: response.businessId ?? businessDetails.id,
          description: `${userName} | updated sub account | ${
            response.name ?? values.name ?? details?.name ?? ''
          }`,
          subaccountId: response.id ?? details?.id,
        })
      } catch (logError) {
        console.error('[SubAccountDetails] activity log failed:', logError)
      }

      toast({
        title: 'Subaccount details saved',
        description: 'Successfully saved your subaccount details.',
      })

      setClose()
      router.refresh()
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Oops!',
        description:
          error instanceof Error
            ? error.message
            : 'Could not save sub account details.',
      })
    }
  }

  useEffect(() => {
    if (details?.id) {
      form.reset(details)
    }
  }, [details])

  const isLoading = form.formState.isSubmitting
  //CHALLENGE Create this form.
  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle>Sub Account Information</CardTitle>
        <CardDescription>Please enter business details</CardDescription>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              disabled={isLoading}
              control={form.control}
              name="subAccountLogo"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Account Logo</FormLabel>
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
            <div className="flex gap-4 md:flex-row">
              <FormField
                disabled={isLoading}
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem className="flex-1">
                    <FormLabel>Account Name</FormLabel>
                    <FormControl>
                      <Input
                        required
                        placeholder="Your business name"
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
                name="companyEmail"
                render={({ field }) => (
                  <FormItem className="flex-1">
                    <FormLabel>Acount Email</FormLabel>
                    <FormControl>
                      <Input placeholder="Email" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            <div className="flex gap-4 md:flex-row">
              <FormField
                disabled={isLoading}
                control={form.control}
                name="companyPhone"
                render={({ field }) => (
                  <FormItem className="flex-1">
                    <FormLabel>Acount Phone Number</FormLabel>
                    <FormControl>
                      <Input placeholder="Phone" required {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              disabled={isLoading}
              control={form.control}
              name="address"
              render={({ field }) => (
                <FormItem className="flex-1">
                  <FormLabel>Address</FormLabel>
                  <FormControl>
                    <Input required placeholder="123 st..." {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <div className="flex gap-4 md:flex-row">
              <FormField
                disabled={isLoading}
                control={form.control}
                name="city"
                render={({ field }) => (
                  <FormItem className="flex-1">
                    <FormLabel>City</FormLabel>
                    <FormControl>
                      <Input required placeholder="City" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                disabled={isLoading}
                control={form.control}
                name="state"
                render={({ field }) => (
                  <FormItem className="flex-1">
                    <FormLabel>State</FormLabel>
                    <FormControl>
                      <Input required placeholder="State" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                disabled={isLoading}
                control={form.control}
                name="zipCode"
                render={({ field }) => (
                  <FormItem className="flex-1">
                    <FormLabel>Zipcpde</FormLabel>
                    <FormControl>
                      <Input required placeholder="Zipcode" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            <FormField
              disabled={isLoading}
              control={form.control}
              name="country"
              render={({ field }) => (
                <FormItem className="flex-1">
                  <FormLabel>Country</FormLabel>
                  <FormControl>
                    <Input required placeholder="Country" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <Button type="submit" disabled={isLoading}>
              {isLoading ? <Loading /> : 'Save Account Information'}
            </Button>
          </form>
        </Form>
      </CardContent>
    </Card>
  )
}

export default SubAccountDetails
