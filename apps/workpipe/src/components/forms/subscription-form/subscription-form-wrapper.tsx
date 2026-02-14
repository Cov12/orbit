'use client'
import { useEffect, useMemo, useState } from 'react'

import { Plan } from '@prisma/client'
import { Elements } from '@stripe/react-stripe-js'
import { Stripe, StripeElementsOptions } from '@stripe/stripe-js'
import clsx from 'clsx'
import { useRouter } from 'next/navigation'

import SubscriptionForm from '@/components/forms/subscription-form'
import Loading from '@/components/global/loading'
import { Card, CardHeader, CardTitle } from '@/components/ui/card'
import { toast } from '@/components/ui/use-toast'
import { pricingCards } from '@/lib/constants'
import { getStripe } from '@/lib/stripe/stripe-client'
import { useModal } from '@/providers/modal-provider'

type Props = {
  customerId: string
  planExists: boolean
}

const SubscriptionFormWrapper = ({ customerId, planExists }: Props) => {
  const { data, setClose } = useModal()
  const router = useRouter()
  const [selectedPriceId, setSelectedPriceId] = useState<Plan | ''>(
    data?.plans?.defaultPriceId || ''
  )
  const [subscription, setSubscription] = useState<{
    subscriptionId: string
    clientSecret: string
  }>({ subscriptionId: '', clientSecret: '' })
  const [stripe, setStripe] = useState<Stripe | null>(null);

  const options: StripeElementsOptions = useMemo(
    () => ({
      clientSecret: subscription?.clientSecret,
      appearance: {
        theme: 'flat',
        style: {
          base: {
            border: '1px solid red',
          },
        },
      },
    }),
    [subscription]
  )

  useEffect(() => {
    // Guard: don't attempt subscription creation without a Stripe customer ID
    if (!selectedPriceId || !customerId) return
    const createSecret = async () => {
      const subscriptionResponse = await fetch(
        '/api/stripe/create-subscription',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            customerId,
            priceId: selectedPriceId,
          }),
        }
      )
      const subscriptionResponseData = await subscriptionResponse.json()
      setSubscription({
        clientSecret: subscriptionResponseData.clientSecret,
        subscriptionId: subscriptionResponseData.subscriptionId,
      })
      if (planExists) {
        toast({
          title: 'Success',
          description: 'Your plan has been successfully upgraded!',
        })
        setClose()
        router.refresh()
      }
    }
    createSecret();

    const initializeStripe = async () => {
      setStripe(await getStripe());
    };
    initializeStripe();
  }, [data, selectedPriceId, customerId, planExists]);

  // If no Stripe customer is set up, prompt the user to set up billing first
  if (!customerId) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 p-4">
        <p className="text-center text-muted-foreground">
          You need to set up billing before subscribing to a plan.
          Please contact support or set up your payment details first.
        </p>
      </div>
    )
  }

  return (
    <div className="border-none transition-all">
      <div className="flex flex-col gap-4">
        {data.plans?.plans ? (
          data.plans.plans.map((price: any) => (
            <Card
              onClick={() => setSelectedPriceId(price.id as Plan)}
              key={price.id}
              className={clsx('relative cursor-pointer transition-all', {
                'border-primary': selectedPriceId === price.id,
              })}
            >
              <CardHeader>
                <CardTitle>
                  ${price.unit_amount ? price.unit_amount / 100 : '0'}
                  <p className="text-sm text-muted-foreground">
                    {price.nickname}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {
                      pricingCards.find((p: any) => p.priceId === price.id)
                        ?.description
                    }
                  </p>
                </CardTitle>
              </CardHeader>
              {selectedPriceId === price.id && (
                <div className="w-2 h-2 bg-emerald-500 rounded-full absolute top-4 right-4" />
              )}
            </Card>
          ))
        ) : null}

        {options.clientSecret && stripe ? (
          <Elements
            // @ts-ignore
            stripe={stripe}
            options={options}
          >
            <SubscriptionForm selectedPriceId={selectedPriceId} />
          </Elements>
        ) : (
          //cleanup
          // <div>Stripe is not initialized. Please check your Stripe publishable key.</div>
          <div className="flex items-center justify-center w-full h-40">
          <Loading />
        </div>
        )}
      </div>
    </div>
  )
}

export default SubscriptionFormWrapper
