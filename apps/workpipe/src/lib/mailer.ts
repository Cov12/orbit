import nodemailer, { type Transporter } from 'nodemailer'

/**
 * Minimal SMTP mailer for transactional invoice email. Configured entirely from
 * env (set in Render):
 *   INVOICE_NOTIFICATION_HOST    SMTP host
 *   INVOICE_NOTIFICATION_PORT    SMTP port (defaults to 587)
 *   INVOICE_NOTIFICATION_EMAIL   SMTP username + the "from" address
 *   INVOICE_NOTIFICATION_SECRET  SMTP password
 *
 * Server-only — imported by server actions, never by client code.
 */
let cached: Transporter | null = null

function getTransport(): Transporter {
  if (cached) return cached
  const host = process.env.INVOICE_NOTIFICATION_HOST
  const port = Number(process.env.INVOICE_NOTIFICATION_PORT || 587)
  const user = process.env.INVOICE_NOTIFICATION_EMAIL
  const pass = process.env.INVOICE_NOTIFICATION_SECRET
  if (!host || !user || !pass) {
    throw new Error('SMTP is not configured (INVOICE_NOTIFICATION_* env vars)')
  }
  cached = nodemailer.createTransport({
    host,
    port,
    secure: port === 465, // 465 = implicit TLS; 587/25 = STARTTLS
    auth: { user, pass },
  })
  return cached
}

export async function sendMail({
  to,
  subject,
  html,
  fromName,
}: {
  to: string
  subject: string
  html: string
  fromName?: string
}): Promise<void> {
  const fromEmail = process.env.INVOICE_NOTIFICATION_EMAIL
  if (!fromEmail) {
    throw new Error('SMTP is not configured (INVOICE_NOTIFICATION_EMAIL)')
  }
  const from = fromName ? `"${fromName}" <${fromEmail}>` : fromEmail
  await getTransport().sendMail({ from, to, subject, html })
}
