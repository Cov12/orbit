'use client'
import { useEffect, useState } from 'react'

import { Send } from 'lucide-react'
import { useRouter } from 'next/navigation'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { toast } from '@/components/ui/use-toast'
import { getContactOptions, sendInvoiceEmail } from '@/lib/queries'
import { useModal } from '@/providers/modal-provider'

import Loading from '../global/loading'

type ContactOption = { id: string; name: string; email: string }

interface SendInvoiceFormProps {
  subAccountId: string
  invoiceId: string
}

const SendInvoiceForm: React.FC<SendInvoiceFormProps> = ({
  subAccountId,
  invoiceId,
}) => {
  const { setClose } = useModal()
  const router = useRouter()
  const [contacts, setContacts] = useState<ContactOption[]>([])
  const [email, setEmail] = useState('')
  const [sending, setSending] = useState(false)

  useEffect(() => {
    getContactOptions(subAccountId)
      .then(setContacts)
      .catch(() => setContacts([]))
  }, [subAccountId])

  const onPickContact = (contactId: string) => {
    const contact = contacts.find(c => c.id === contactId)
    if (contact) setEmail(contact.email)
  }

  const onSend = async () => {
    setSending(true)
    try {
      const res = await sendInvoiceEmail(subAccountId, invoiceId, email)
      if (!res.ok) {
        toast({
          variant: 'destructive',
          title: 'Invoice not sent',
          description:
            res.reason === 'EMAIL_NOT_CONFIGURED'
              ? 'Email delivery isn’t set up for this workspace. Use “Copy pay link” to share the invoice instead.'
              : 'The email could not be delivered, and the invoice was left unchanged. Please try again.',
        })
        setSending(false)
        return
      }
      toast({ title: 'Invoice sent', description: `Emailed to ${email}` })
      setClose()
      router.refresh()
    } catch (error) {
      const invalid =
        error instanceof Error && error.message === 'INVALID_EMAIL'
      toast({
        variant: 'destructive',
        title: 'Oops!',
        description: invalid
          ? 'Enter a valid email address'
          : 'Could not send the invoice. Please try again.',
      })
      setSending(false)
    }
  }

  return (
    <Card className="flex-1">
      <CardHeader>
        <CardTitle>Send invoice</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {contacts.length > 0 && (
          <div className="flex flex-col gap-2">
            <Label>Pick a contact</Label>
            <Select onValueChange={onPickContact}>
              <SelectTrigger>
                <SelectValue placeholder="Choose a contact…" />
              </SelectTrigger>
              <SelectContent>
                {contacts.map(c => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name} — {c.email}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        <div className="flex flex-col gap-2">
          <Label>Customer email</Label>
          <Input
            type="email"
            placeholder="customer@example.com"
            value={email}
            onChange={e => setEmail(e.target.value)}
          />
        </div>

        <Button
          className="gap-2 self-end"
          disabled={sending || !email}
          onClick={onSend}
        >
          {sending ? (
            <Loading />
          ) : (
            <>
              <Send size={15} /> Send
            </>
          )}
        </Button>
      </CardContent>
    </Card>
  )
}

export default SendInvoiceForm
