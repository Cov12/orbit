'use client'
import { Printer } from 'lucide-react'

import { Button } from '@/components/ui/button'

// "Save as PDF" = the browser's print-to-PDF over the isolated invoice document
// (see the @media print rules in globals.css). No PDF dependency required.
export default function PrintInvoiceButton() {
  return (
    <Button
      variant="outline"
      className="no-print gap-2"
      onClick={() => window.print()}
    >
      <Printer size={15} /> Save as PDF
    </Button>
  )
}
