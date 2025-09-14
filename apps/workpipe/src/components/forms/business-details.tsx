'use client'
import { Business } from '@prisma/client'
import { useForm } from 'react-hook-form'
import React, { useEffect, useState } from 'react'
import { NumberInput } from '@tremor/react'
import { v4 } from 'uuid'
import { useToast } from '../ui/use-toast'
import * as z from 'zod'
import FileUpload from '../global/file-upload'
import Loading from '../global/loading'
import { Input } from '../ui/input'
import { Switch } from '../ui/switch'
import {
    initUser,
    saveActivityLogsNotification,
    upsertBusiness,
    updateBusinessDetails,
    deleteBusiness,
  } from '@/lib/queries'
import { zodResolver } from '@hookform/resolvers/zod'
import { useRouter } from 'next/navigation'
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
    AlertDialogTrigger,
  } from '../ui/alert-dialog'
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
    FormDescription,
    FormField,
    FormItem,
    FormLabel,
    FormMessage,
  } from '../ui/form'
  import { Button } from '../ui/button'

  type Props = {
    data?: Partial<Business>
  }

  const FormSchema = z.object({
    name: z.string().min(2, { message: 'Business name must be atleast 2 chars.' }),
    companyEmail: z.string().min(1),
    companyPhone: z.string().min(1),
    whiteLabel: z.boolean(),
    address: z.string().min(1),
    city: z.string().min(1),
    zipCode: z.string().min(1),
    state: z.string().min(1),
    country: z.string(),
    businessLogo: z.string().min(1),
  })

  const BusinessDetails = ({ data }: Props) => {
    const { toast } = useToast()
    const router = useRouter()
    const [deletingBusiness, setDeletingBusiness] = useState(false)
    const form = useForm<z.infer<typeof FormSchema>>({
      mode: 'onChange',
      resolver: zodResolver(FormSchema),
      defaultValues: {
        name: data?.name,
        companyEmail: data?.companyEmail,
        companyPhone: data?.companyPhone,
        whiteLabel: data?.whiteLabel || false,
        address: data?.address,
        city: data?.city,
        zipCode: data?.zipCode,
        state: data?.state,
        country: data?.country || '',
        businessLogo: data?.businessLogo,
      },
    })
    const isLoading = form.formState.isSubmitting
  
    useEffect(() => {
      if (data) {
        form.reset(data)
      }
    }, [data])
  
    const handleSubmit = async (values: z.infer<typeof FormSchema>) => {
      try {
        let newUserData
        let custId
        if (!data?.id) {
          const bodyData = {
            email: values.companyEmail,
            name: values.name,
            shipping: {
              address: {
                city: values.city,
                country: values.country,
                line1: values.address,
                postal_code: values.zipCode,
                state: values.zipCode,
              },
              name: values.name,
            },
            address: {
              city: values.city,
              country: values.country,
              line1: values.address,
              postal_code: values.zipCode,
              state: values.zipCode,
            },
          }
  
           const customerResponse = await fetch('/api/stripe/create-customer', {
             method: 'POST',
             headers: {
               'Content-Type': 'application/json',
             },
             body: JSON.stringify(bodyData),
           })
           const customerData: { customerId: string } = await customerResponse.json()
           custId = customerData.customerId
        }
  
        newUserData = await initUser({ role: 'BUSINESS_OWNER' })
        if (!data?.customerId && !custId) return
  
        const response = await upsertBusiness({
          id: data?.id ? data.id : v4(),
          customerId: data?.customerId || custId || '',
          address: values.address,
          businessLogo: values.businessLogo,
          city: values.city,
          companyPhone: values.companyPhone,
          country: values.country || '',
          name: values.name,
          state: values.state,
          whiteLabel: values.whiteLabel,
          zipCode: values.zipCode,
          createdAt: new Date(),
          updatedAt: new Date(),
          companyEmail: values.companyEmail,
          connectAccountId: '',
          goal: 5,
        })
        toast({
          title: 'Created Business',
        })
        if (data?.id) return router.refresh()
        if (response) {
          return router.refresh()
        }
      } catch (error) {
        console.log(error)
        toast({
          variant: 'destructive',
          title: 'Oppse!',
          description: 'could not create your business',
        })
      }
    }
    const handleDeleteBusiness = async () => {
      if (!data?.id) return
      setDeletingBusiness(true)
      //Cleanup
      //To Do: discontinue the subscription
      try {
        const response = await deleteBusiness(data.id)
        toast({
          title: 'Deleted Business',
          description: 'Deleted your business and all subaccounts',
        })
        router.refresh()
      } catch (error) {
        console.log(error)
        toast({
          variant: 'destructive',
          title: 'Oppse!',
          description: 'could not delete your business ',
        })
      }
      setDeletingBusiness(false)
    }
  
    return (
      <AlertDialog>
        <Card className="w-full">
          <CardHeader>
            <CardTitle>Business Information</CardTitle>
            <CardDescription>
              Lets create an profile for you business. You can edit your business details
              later from the settings tab.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Form {...form}>
              <form
                onSubmit={form.handleSubmit(handleSubmit)}
                className="space-y-4"
              >
                <FormField
                  disabled={isLoading}
                  control={form.control}
                  name="businessLogo"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Business Logo</FormLabel>
                      <FormControl>
                        <FileUpload
                          apiEndpoint="businessLogo"
                          onChange={field.onChange}
                          value={field.value}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <div className="flex md:flex-row gap-4">
                  <FormField
                    disabled={isLoading}
                    control={form.control}
                    name="name"
                    render={({ field }) => (
                      <FormItem className="flex-1">
                        <FormLabel>Business Name</FormLabel>
                        <FormControl>
                          <Input
                            placeholder="Your business name"
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="companyEmail"
                    render={({ field }) => (
                      <FormItem className="flex-1">
                        <FormLabel>Business Email</FormLabel>
                        <FormControl>
                          <Input
                            readOnly
                            placeholder="Email"
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                <div className="flex md:flex-row gap-4">
                  <FormField
                    disabled={isLoading}
                    control={form.control}
                    name="companyPhone"
                    render={({ field }) => (
                      <FormItem className="flex-1">
                        <FormLabel>Business Phone Number</FormLabel>
                        <FormControl>
                          <Input
                            placeholder="Phone"
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
  
                <FormField
                  disabled={isLoading}
                  control={form.control}
                  name="whiteLabel"
                  render={({ field }) => {
                    return (
                      <FormItem className="flex flex-row items-center justify-between rounded-lg border gap-4 p-4">
                        <div>
                          <FormLabel>Whitelabel Business</FormLabel>
                          <FormDescription>
                            Turning on whilelabel mode will show your business logo
                            to all sub accounts by default. You can overwrite this
                            functionality through sub account settings.
                          </FormDescription>
                        </div>
  
                        <FormControl>
                          <Switch
                            checked={field.value}
                            onCheckedChange={field.onChange}
                          />
                        </FormControl>
                      </FormItem>
                    )
                  }}
                />
                <FormField
                  disabled={isLoading}
                  control={form.control}
                  name="address"
                  render={({ field }) => (
                    <FormItem className="flex-1">
                      <FormLabel>Address</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="123 st..."
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <div className="flex md:flex-row gap-4">
                  <FormField
                    disabled={isLoading}
                    control={form.control}
                    name="city"
                    render={({ field }) => (
                      <FormItem className="flex-1">
                        <FormLabel>City</FormLabel>
                        <FormControl>
                          <Input
                            placeholder="City"
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
                    name="state"
                    render={({ field }) => (
                      <FormItem className="flex-1">
                        <FormLabel>State</FormLabel>
                        <FormControl>
                          <Input
                            placeholder="State"
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
                    name="zipCode"
                    render={({ field }) => (
                      <FormItem className="flex-1">
                        <FormLabel>Zipcode</FormLabel>
                        <FormControl>
                          <Input
                            placeholder="Zipcode"
                            {...field}
                          />
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
                        <Input
                          placeholder="Country"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                {data?.id && (
                  <div className="flex flex-col gap-2">
                    <FormLabel>Create A Goal</FormLabel>
                    <FormDescription>
                      ✨ Create a goal for your business. As your business grows
                      your goals grow too so dont forget to set the bar higher!
                    </FormDescription>
                    <NumberInput
                      defaultValue={data?.goal}
                      onValueChange={async (val) => {
                        if (!data?.id) return
                        await updateBusinessDetails(data.id, { goal: val })
                        await saveActivityLogsNotification({
                          businessId: data.id,
                          description: `Updated the business goal to | ${val} Sub Account`,
                          subaccountId: undefined,
                        })
                        router.refresh()
                      }}
                      min={1}
                      className="bg-background !border !border-input"
                      placeholder="Sub Account Goal"
                    />
                  </div>
                )}
                <Button
                  type="submit"
                  disabled={isLoading}
                >
                  {isLoading ? <Loading /> : 'Save Business Information'}
                </Button>
              </form>
            </Form>
  
            {data?.id && (
              <div className="flex flex-row items-center justify-between rounded-lg border border-destructive gap-4 p-4 mt-4">
                <div>
                  <div>Danger Zone</div>
                </div>
                <div className="text-muted-foreground">
                  Deleting your business cannpt be undone. This will also delete all
                  sub accounts and all data related to your sub accounts. Sub
                  accounts will no longer have access to funnels, contacts etc.
                </div>
                <AlertDialogTrigger
                  disabled={isLoading || deletingBusiness}
                  className="text-red-600 p-2 text-center mt-2 rounded-md hove:bg-red-600 hover:text-white whitespace-nowrap"
                >
                  {deletingBusiness ? 'Deleting...' : 'Delete Business'}
                </AlertDialogTrigger>
              </div>
            )}
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle className="text-left">
                  Are you absolutely sure?
                </AlertDialogTitle>
                <AlertDialogDescription className="text-left">
                  This action cannot be undone. This will permanently delete the
                  Business account and all related sub accounts.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter className="flex items-center">
                <AlertDialogCancel className="mb-2">Cancel</AlertDialogCancel>
                <AlertDialogAction
                  disabled={deletingBusiness}
                  className="bg-destructive hover:bg-destructive"
                  onClick={handleDeleteBusiness}
                >
                  Delete
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </CardContent>
        </Card>
      </AlertDialog>
    )
  }

  export default BusinessDetails