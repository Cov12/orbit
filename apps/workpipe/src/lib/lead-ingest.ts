import type { Prisma } from '@prisma/client'
import { z } from 'zod'

import { normalizeEmail } from './contact-normalize'
import { db } from './db'

/**
 * Public lead-capture ingest (issue #54 phase 3).
 *
 * The HTTP concerns (CORS, method routing, header reading) live in
 * `src/app/api/forms/[formKey]/submit/route.ts`; everything that decides what
 * gets written — form resolution, validation, bot filtering, rate limiting,
 * contact dedupe and submission attribution — lives here so it can be unit
 * tested without a request object.
 *
 * The single most important invariant: the sub-account a submission lands in
 * comes from the `LeadForm` row resolved by `formKey`. The request body is
 * anonymous and untrusted, so any `subAccountId` in it is stripped by the zod
 * schema and never reaches the database.
 */

/** Largest body we will even parse — anonymous callers, so cap it hard. */
export const MAX_BODY_BYTES = 32 * 1024
/** Per-field cap applied to every string in the payload. */
export const MAX_FIELD_LENGTH = 2000
/** Sliding window for the per-IP submission limit. */
export const RATE_LIMIT_WINDOW_MS = 60_000
/** Submissions allowed per IP per sub-account inside that window. */
export const RATE_LIMIT_MAX_SUBMISSIONS = 10
/** Hidden input real forms leave blank; anything in it means a bot. */
export const HONEYPOT_FIELD = 'website_url'
/** `Tag.color` is required; default-tag writes have no palette to pick from. */
const DEFAULT_TAG_COLOR = 'BLUE'

/** Every incoming string is trimmed then length-capped. */
const capped = z.string().trim().max(MAX_FIELD_LENGTH)

/**
 * Unknown keys are stripped (zod's default), which is what keeps a
 * body-supplied `subAccountId` from ever reaching a write — including the
 * `rawPayload` snapshot, which stores the *parsed* value.
 */
export const leadSubmissionSchema = z.object({
  firstName: capped.optional(),
  lastName: capped.optional(),
  name: capped.optional(),
  email: capped.email().optional(),
  phone: capped.optional(),
  companyName: capped.optional(),
  address1: capped.optional(),
  address2: capped.optional(),
  city: capped.optional(),
  state: capped.optional(),
  postalCode: capped.optional(),
  country: capped.optional(),
  website: capped.optional(),
  utm: z
    .object({
      source: capped.optional(),
      medium: capped.optional(),
      campaign: capped.optional(),
      term: capped.optional(),
      content: capped.optional(),
    })
    .optional(),
  referrerUrl: capped.optional(),
  landingPageUrl: capped.optional(),
  customFields: z.record(z.unknown()).optional(),
  [HONEYPOT_FIELD]: capped.optional(),
})

export type LeadSubmission = z.infer<typeof leadSubmissionSchema>

export type LeadIngestInput = {
  formKey: string
  /** Raw request body text — parsed here so the size cap applies pre-JSON. */
  rawBody: string
  ipAddress: string | null
  userAgent: string | null
}

export type LeadIngestResult =
  | {
      ok: true
      status: 200
      body: {
        success: true
        contactId?: string
        submissionId?: string
        redirectUrl?: string
      }
    }
  | { ok: false; status: number; error: string; code: string }

const failure = (
  status: number,
  error: string,
  code: string
): LeadIngestResult => ({ ok: false, status, error, code })

/** Trusted reverse-proxy hops in front of the app (Render's edge = 1). */
export const TRUSTED_PROXY_HOPS = 1

/**
 * Client IP behind Render's reverse proxy, for rate-limiting and attribution.
 *
 * `x-forwarded-for` is a client-appendable chain: a caller can prepend a forged
 * IP and the proxy appends the real one, so the *leftmost* entry is spoofable
 * (which would let an attacker rotate it to dodge the per-IP limit). Take the
 * hop the trusted proxy actually observed — `TRUSTED_PROXY_HOPS` from the right
 * — which a client cannot forge. Falls back to `x-real-ip`.
 */
export const clientIpFromHeaders = (headers: Headers): string | null => {
  const forwarded = headers.get('x-forwarded-for')
  if (forwarded) {
    const parts = forwarded
      .split(',')
      .map(p => p.trim())
      .filter(Boolean)
    const ip = parts[parts.length - TRUSTED_PROXY_HOPS]
    if (ip) return ip
  }
  return headers.get('x-real-ip')?.trim() || null
}

/**
 * Drop absent values (`undefined`, `null`, blank string) so a sparse
 * submission merges onto an existing contact without blanking stored fields.
 */
const defined = <T extends Record<string, unknown>>(obj: T): Partial<T> => {
  const out: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(obj)) {
    if (value === undefined || value === null || value === '') continue
    out[key] = value
  }
  return out as Partial<T>
}

/** Best-effort display name — `Contact.name` is required by the schema. */
const resolveName = (body: LeadSubmission, email?: string): string => {
  const composed = [body.firstName, body.lastName].filter(Boolean).join(' ')
  return body.name || composed || email || 'Unknown'
}

export async function ingestLeadSubmission({
  formKey,
  rawBody,
  ipAddress,
  userAgent,
}: LeadIngestInput): Promise<LeadIngestResult> {
  if (Buffer.byteLength(rawBody, 'utf8') > MAX_BODY_BYTES) {
    return failure(413, 'Request body too large', 'PAYLOAD_TOO_LARGE')
  }

  let parsedJson: unknown
  try {
    parsedJson = JSON.parse(rawBody || '{}')
  } catch {
    return failure(422, 'Invalid JSON body', 'VALIDATION_ERROR')
  }

  // The form row is the sole source of the sub-account for this submission.
  const leadForm = await db.leadForm.findUnique({ where: { key: formKey } })
  if (!leadForm) {
    return failure(404, 'Form not found', 'NOT_FOUND')
  }
  if (!leadForm.isActive) {
    return failure(403, 'Form is not accepting submissions', 'FORBIDDEN')
  }

  const parsed = leadSubmissionSchema.safeParse(parsedJson)
  if (!parsed.success) {
    return failure(422, 'Invalid submission payload', 'VALIDATION_ERROR')
  }
  const body = parsed.data

  // Honeypot: bots fill every input they find. Answer like a real success so
  // they learn nothing, and write nothing at all.
  if (body[HONEYPOT_FIELD]) {
    return { ok: true, status: 200, body: { success: true } }
  }

  const email = normalizeEmail(body.email)
  if (!email && !body.name && !body.firstName) {
    return failure(422, 'An email or a name is required', 'VALIDATION_ERROR')
  }

  if (ipAddress) {
    const recent = await db.contactSubmission.count({
      where: {
        subAccountId: leadForm.subAccountId,
        ipAddress,
        createdAt: { gte: new Date(Date.now() - RATE_LIMIT_WINDOW_MS) },
      },
    })
    if (recent >= RATE_LIMIT_MAX_SUBMISSIONS) {
      return failure(429, 'Too many submissions', 'RATE_LIMITED')
    }
  }

  const now = new Date()
  const attribution = defined({
    utmSource: body.utm?.source,
    utmMedium: body.utm?.medium,
    utmCampaign: body.utm?.campaign,
    utmTerm: body.utm?.term,
    utmContent: body.utm?.content,
    referrerUrl: body.referrerUrl,
    landingPageUrl: body.landingPageUrl,
    ipAddress,
    userAgent,
  })

  const contactFields = {
    ...defined({
      firstName: body.firstName,
      lastName: body.lastName,
      phone: body.phone,
      companyName: body.companyName,
      address1: body.address1,
      address2: body.address2,
      city: body.city,
      state: body.state,
      postalCode: body.postalCode,
      country: body.country,
      website: body.website,
      customFields: body.customFields as Prisma.InputJsonValue | undefined,
    }),
    ...attribution,
    sourceFormId: leadForm.id,
    sourceFormName: leadForm.name,
    lastSeenAt: now,
    lastSubmittedAt: now,
  }

  // Same dedupe key as persistContact: sub-account + case-insensitive email.
  const existing = email
    ? await db.contact.findFirst({
        where: {
          subAccountId: leadForm.subAccountId,
          email: { equals: email, mode: 'insensitive' },
        },
        select: { id: true },
      })
    : null

  const contact = existing
    ? // Merge onto the existing lead — `firstSeenAt` is deliberately untouched.
      await db.contact.update({
        where: { id: existing.id },
        data: {
          ...contactFields,
          ...defined({ email, name: body.name }),
        },
      })
    : await db.contact.create({
        data: {
          ...contactFields,
          subAccountId: leadForm.subAccountId,
          name: resolveName(body, email),
          email: email ?? '',
          firstSeenAt: now,
        },
      })

  const isFirstTouch = !existing

  await db.contactSubmission.updateMany({
    where: { contactId: contact.id },
    data: { isLastTouch: false },
  })

  const submission = await db.contactSubmission.create({
    data: {
      contactId: contact.id,
      subAccountId: leadForm.subAccountId,
      formId: leadForm.id,
      formName: leadForm.name,
      submissionType: 'form',
      ...attribution,
      rawPayload: body as Prisma.InputJsonValue,
      isFirstTouch,
      isLastTouch: true,
    },
  })

  for (const tagName of leadForm.defaultTags) {
    const tag =
      (await db.tag.findFirst({
        where: { subAccountId: leadForm.subAccountId, name: tagName },
        select: { id: true },
      })) ??
      (await db.tag.create({
        data: {
          name: tagName,
          color: DEFAULT_TAG_COLOR,
          subAccountId: leadForm.subAccountId,
        },
      }))

    await db.contact.update({
      where: { id: contact.id },
      data: { Tags: { connect: { id: tag.id } } },
    })
  }

  // Deliberately identical whether the contact was created or merged — the
  // response must not tell an anonymous caller which emails are already known.
  return {
    ok: true,
    status: 200,
    body: {
      success: true,
      contactId: contact.id,
      submissionId: submission.id,
      ...(leadForm.redirectUrl ? { redirectUrl: leadForm.redirectUrl } : {}),
    },
  }
}
