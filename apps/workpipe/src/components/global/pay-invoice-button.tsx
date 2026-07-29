'use client'
import { useState } from 'react'

import { CreditCard } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { toast } from '@/components/ui/use-toast'

// Public "Pay now" button on the invoice pay-link page. Starts a Stripe Connect
// hosted checkout (amount resolved server-side from the invoice) and redirects.
export default function PayInvoiceButton({
  token,
  amountLabel,
}: {
  token: string
  amountLabel: string
}) {
  const [loading, setLoading] = useState(false)

  const handlePay = async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/stripe/invoice-checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token }),
      })
      const data = await res.json()
      if (!res.ok || !data.url) {
        throw new Error(data.error || 'Checkout failed')
      }
      window.location.href = data.url
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Payment error',
        description:
          error instanceof Error ? error.message : 'Could not start checkout',
      })
      setLoading(false)
    }
  }

  return (
    <Button size="lg" className="gap-2" disabled={loading} onClick={handlePay}>
      <CreditCard size={16} />
      {loading ? 'Redirecting…' : `Pay ${amountLabel}`}
    </Button>
  )
}
