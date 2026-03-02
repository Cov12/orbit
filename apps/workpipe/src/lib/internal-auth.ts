import { db } from '@/lib/db'

type JwtPayload = {
  org_id?: string
  user_id?: string
  sub?: string
  [key: string]: unknown
}

const textEncoder = new TextEncoder()

const base64UrlToUint8 = (input: string) => {
  const normalized = input.replace(/-/g, '+').replace(/_/g, '/')
  const padLength = (4 - (normalized.length % 4)) % 4
  const padded = normalized + '='.repeat(padLength)
  return Uint8Array.from(Buffer.from(padded, 'base64'))
}

const timingSafeEqual = (a: Uint8Array, b: Uint8Array) => {
  if (a.length !== b.length) return false
  let out = 0
  for (let i = 0; i < a.length; i++) out |= a[i] ^ b[i]
  return out === 0
}

const verifyHs256 = async (token: string, secret: string) => {
  const parts = token.split('.')
  if (parts.length !== 3) return null

  const [headerB64, payloadB64, signatureB64] = parts
  const data = `${headerB64}.${payloadB64}`

  const key = await crypto.subtle.importKey(
    'raw',
    textEncoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  )

  const computed = new Uint8Array(
    await crypto.subtle.sign('HMAC', key, textEncoder.encode(data))
  )
  const provided = base64UrlToUint8(signatureB64)

  if (!timingSafeEqual(computed, provided)) return null

  try {
    const payloadRaw = Buffer.from(base64UrlToUint8(payloadB64)).toString('utf8')
    const payload = JSON.parse(payloadRaw) as JwtPayload

    if (typeof payload.exp === 'number') {
      const now = Math.floor(Date.now() / 1000)
      if (payload.exp < now) return null
    }

    return payload
  } catch {
    return null
  }
}

export async function validateInternalAuth(
  request: Request
): Promise<{ businessId: string; userId: string; orgId: string }> {
  const authHeader = request.headers.get('authorization')
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    throw new Error('UNAUTHORIZED')
  }

  const token = authHeader.slice(7).trim()
  const secret = process.env.JWT_SECRET

  if (!secret) {
    throw new Error('INTERNAL_ERROR')
  }

  const payload = await verifyHs256(token, secret)
  if (!payload) {
    throw new Error('UNAUTHORIZED')
  }

  const orgId = typeof payload.org_id === 'string' ? payload.org_id : undefined
  const userId =
    typeof payload.user_id === 'string'
      ? payload.user_id
      : typeof payload.sub === 'string'
        ? payload.sub
        : undefined

  if (!orgId || !userId) {
    throw new Error('UNAUTHORIZED')
  }

  const business = await db.business.findUnique({ where: { id: orgId } })
  if (!business) {
    throw new Error('FORBIDDEN')
  }

  return { businessId: business.id, userId, orgId }
}

export async function validateSubAccountForBusiness(
  subAccountId: string,
  businessId: string
) {
  const subAccount = await db.subAccount.findUnique({
    where: { id: subAccountId },
    select: { id: true, businessId: true },
  })

  if (!subAccount) {
    throw new Error('NOT_FOUND')
  }

  if (subAccount.businessId !== businessId) {
    throw new Error('FORBIDDEN')
  }

  return subAccount
}
