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
  // The SMTP auth username is frequently NOT the from-address (e.g. SendGrid =
  // "apikey", Resend = "resend", Mailgun = "postmaster@..."). Allow it to be set
  // separately; fall back to the from-address for providers where they match.
  const user =
    process.env.INVOICE_NOTIFICATION_USER ||
    process.env.INVOICE_NOTIFICATION_EMAIL
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

/** True when every setting sendMail needs is present, so callers can skip work up front. */
export function isMailConfigured(): boolean {
  const user =
    process.env.INVOICE_NOTIFICATION_USER ||
    process.env.INVOICE_NOTIFICATION_EMAIL
  return Boolean(
    process.env.INVOICE_NOTIFICATION_HOST &&
      user &&
      process.env.INVOICE_NOTIFICATION_SECRET &&
      process.env.INVOICE_NOTIFICATION_EMAIL
  )
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
