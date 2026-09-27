import clsx from 'clsx'
import { Check } from 'lucide-react'
import Link from 'next/link'

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
/** Pricing managed in Portal — these are display-only for the landing page */
const pricingCards = [
  {
    title: 'Starter',
    description: 'For solo operators getting started with CRM.',
    price: '$—',
    duration: 'month',
    features: [
      '1 user',
      '500 contacts',
      'Pipelines & deals',
      'Basic automations',
      'Invoicing',
      'Orbit Drive (1 GB)',
    ],
  },
  {
    title: 'Pro',
    description: 'For growing teams that need the full CRM toolkit.',
    price: '$—',
    duration: 'month',
    highlight: true,
    features: [
      '5 users',
      '5,000 contacts',
      'Full automations',
      'Reporting & analytics',
      'API access',
      'Orbit Drive (10 GB)',
    ],
  },
  {
    title: 'Business',
    description: 'For companies that need scale and customization.',
    price: '$—',
    duration: 'month',
    features: [
      '25 users',
      'Unlimited contacts',
      'Advanced reporting',
      'Custom fields',
      'Priority support',
      'Orbit Drive (50 GB)',
    ],
  },
]

export default function Home() {
  return (
    <>
      <section className="relative mt-[-70px] flex h-full w-full flex-col items-center justify-center md:pt-64">
        {/* grid */}

        <div className="absolute -z-10 h-full w-full bg-[radial-gradient(#e5e7eb_1px,transparent_1px)] [background-size:16px_16px] [mask-image:radial-gradient(ellipse_50%_50%_at_50%_50%,#000_70%,transparent_100%)]" />

        <p className="text-center">Run your Business, in one place</p>
        <div className="relative bg-gradient-to-r from-primary to-secondary-foreground bg-clip-text text-transparent">
          <h1 className="text-center text-9xl font-bold md:text-[300px]">
            WORKPIPE
          </h1>
        </div>
      </section>
      <section
        id="pricing"
        className="mt-[-60px] flex flex-col items-center justify-center gap-4 md:!mt-20"
      >
        <h2 className="text-center text-4xl">
          {' '}
          Choose what fits your business.
        </h2>
        <p className="text-center text-muted-foreground">
          Our straightforward pricing plans are tailored to meet your needs. If
          {" you're"} not <br />
          ready to commit you can get started for free.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-4">
          {pricingCards.map(card => (
            <Card
              key={card.title}
              className={clsx('flex w-[300px] flex-col justify-between', {
                'border-2 border-primary': card.highlight,
              })}
            >
              <CardHeader>
                <CardTitle
                  className={clsx('', {
                    'text-muted-foreground': !card.highlight,
                  })}
                >
                  {card.title}
                </CardTitle>
                <CardDescription>
                  {pricingCards.find(c => c.title === card.title)?.description}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <span className="text-4xl font-bold">{card.price}</span>
                <span className="text-muted-foreground">
                  <span>/ {card.duration}</span>
                </span>
              </CardContent>
              <CardFooter className="flex flex-col items-start gap-4">
                <div>
                  {card.features.map(feature => (
                    <div key={feature} className="flex items-center gap-2">
                      <Check className="text-muted-foreground" />
                      <p>{feature}</p>
                    </div>
                  ))}
                </div>
                <Link
                  href={`${process.env.NEXT_PUBLIC_PORTAL_URL || 'https://portal.orbit.example'}/billing`}
                  className={clsx(
                    'w-full rounded-md bg-primary p-2 text-center',
                    {
                      '!bg-muted-foreground': !card.highlight,
                    }
                  )}
                >
                  Get Started
                </Link>
                {/* <div>
                  {pricingCards
                    .find((c) => c.title === card.nickname)
                    ?.features.map((feature) => (
                      <div
                        key={feature}
                        className="flex gap-2"
                      >
                        <Check />
                        <p>{feature}</p>
                      </div>
                    ))}
                </div>
                <Link
                  href={`/business?plan=${card.id}`}
                  className={clsx(
                    'w-full text-center bg-primary p-2 rounded-md',
                    {
                      '!bg-muted-foreground':
                        card.nickname !== 'Unlimited Saas',
                    }
                  )}
                >
                  Get Started
                </Link> */}
              </CardFooter>
            </Card>
          ))}
        </div>
      </section>
    </>
  )
}
