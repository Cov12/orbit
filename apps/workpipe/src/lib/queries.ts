'use server'

import {
  Business,
  Lane,
  Plan,
  Prisma,
  Role,
  SubAccount,
  Tag,
  Ticket,
  User,
} from '@prisma/client'
import { revalidatePath } from 'next/cache'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { v4 } from 'uuid'
import { z } from 'zod'

import { getAuthAdmin, getCurrentUser } from './auth'
import {
  assertOwnsBusiness,
  assertOwnsFunnelPage,
  assertOwnsInvoice,
  assertOwnsLane,
  assertOwnsMedia,
  assertOwnsPipeline,
  assertOwnsSubAccount,
  assertOwnsTag,
  assertOwnsTicket,
} from './authz'
import { db } from './db'
import { computeInvoiceTotals } from './invoice-totals'
import { sendMail } from './mailer'
import { PORTAL_TOKEN_COOKIE } from './portal-jwt'
import {
  CreateFunnelFormSchema,
  CreateMediaType,
  InvoiceFormSchema,
  UpsertFunnelPage,
} from './types'

export const getAuthUserDetails = async () => {
  const user = await getCurrentUser()
  if (!user) {
    return
  }

  const userData = await db.user.findUnique({
    where: {
      email: user.email,
    },
    include: {
      Business: {
        include: {
          SidebarOption: true,
          SubAccount: {
            include: {
              SidebarOption: true,
            },
          },
        },
      },
      Permissions: true,
    },
  })

  return userData
}

export const initUser = async (newUser: Partial<User>) => {
  const user = await getCurrentUser()
  if (!user) return

  const userData = await db.user.upsert({
    where: {
      email: user.email,
    },
    update: newUser,
    create: {
      id: user.id,
      avatarUrl: user.avatar,
      email: user.email,
      name: user.name,
      role: newUser.role || 'SUBACCOUNT_USER',
    },
  })

  const client = await getAuthAdmin()
  await client.users.updateUserMetadata(user.id, {
    privateMetadata: {
      role: newUser.role || 'SUBACCOUNT_USER',
    },
  })

  return userData
}

export const createTeamUser = async (businessId: string, user: User) => {
  if (user.role === 'BUSINESS_OWNER') return null
  const response = await db.user.create({ data: { ...user } })
  return response
}

export const verifyAndAcceptInvitation = async () => {
  let user
  try {
    user = await getCurrentUser()
  } catch (error) {
    console.log(
      'Auth wrapper getCurrentUser() error in verifyAndAcceptInvitation:',
      error
    )
    return redirect('/sign-in')
  }
  if (!user) return redirect('/sign-in')
  const invitationExists = await db.invitation.findUnique({
    where: {
      email: user.email,
      status: 'PENDING',
    },
  })

  if (invitationExists) {
    const userDetails = await createTeamUser(invitationExists.businessId, {
      email: invitationExists.email,
      businessId: invitationExists.businessId,
      avatarUrl: user.avatar,
      id: user.id,
      name: user.name,
      role: invitationExists.role,
      createdAt: new Date(),
      updatedAt: new Date(),
    })
    await saveActivityLogsNotification({
      businessId: invitationExists?.businessId,
      description: `Joined`,
      subaccountId: undefined,
    })

    if (userDetails) {
      const client = await getAuthAdmin()
      await client.users.updateUserMetadata(user.id, {
        privateMetadata: {
          role: userDetails.role || 'SUBACCOUNT_USER',
        },
      })

      await db.invitation.delete({
        where: { email: userDetails.email },
      })

      return userDetails.businessId
    } else return null
  } else {
    const business = await db.user.findUnique({
      where: {
        email: user.email,
      },
    })
    return business ? business.businessId : null
  }
}

export const saveActivityLogsNotification = async ({
  businessId,
  description,
  subaccountId,
}: {
  businessId?: string
  description: string
  subaccountId?: string
}) => {
  // Activity logging is a non-critical side effect — it must never throw and
  // abort the caller's action (saving settings, accepting an invite, etc.).
  // Any failure is logged and swallowed.
  try {
    const authUser = await getCurrentUser()
    let userData
    if (!authUser) {
      const response = await db.user.findFirst({
        where: {
          Business: {
            SubAccount: {
              some: { id: subaccountId },
            },
          },
        },
      })
      if (response) {
        userData = response
      }
    } else {
      userData = await db.user.findUnique({
        where: { email: authUser.email },
      })
    }

    if (!userData) {
      console.log(
        '[saveActivityLogsNotification] could not find a user — skipping'
      )
      return
    }

    let foundBusinessId = businessId
    if (!foundBusinessId) {
      if (!subaccountId) {
        console.error(
          '[saveActivityLogsNotification] no businessId or subaccountId — skipping'
        )
        return
      }
      const response = await db.subAccount.findUnique({
        where: { id: subaccountId },
      })
      if (response) foundBusinessId = response.businessId
    }
    if (!foundBusinessId) {
      console.error(
        '[saveActivityLogsNotification] could not resolve a businessId — skipping'
      )
      return
    }

    if (subaccountId) {
      await db.notification.create({
        data: {
          notification: `${userData.name} | ${description ?? 'Updated information'}`,
          User: { connect: { id: userData.id } },
          Business: { connect: { id: foundBusinessId } },
          SubAccount: { connect: { id: subaccountId } },
        },
      })
    } else {
      await db.notification.create({
        data: {
          notification: `${userData.name} | ${description}`,
          User: { connect: { id: userData.id } },
          Business: { connect: { id: foundBusinessId } },
        },
      })
    }
  } catch (error) {
    console.error(
      '[saveActivityLogsNotification] failed (non-blocking):',
      error
    )
  }
}

export const getNotificationAndUser = async (businessId: string) => {
  await assertOwnsBusiness(businessId)
  try {
    const response = await db.notification.findMany({
      where: { businessId },
      include: { User: true },
      orderBy: {
        createdAt: 'desc',
      },
    })
    return response
  } catch (error) {
    console.log(error)
  }
}

export const updateBusinessDetails = async (
  businessId: string,
  businessDetails: Partial<Business>
) => {
  await assertOwnsBusiness(businessId)
  const response = await db.business.update({
    where: { id: businessId },
    data: { ...businessDetails },
  })
  return response
}

export const deleteBusiness = async (businessId: string) => {
  await assertOwnsBusiness(businessId)
  const response = await db.business.delete({ where: { id: businessId } })
  return response
}

export const upsertBusiness = async (business: Business, _price?: Plan) => {
  if (!business.companyEmail) return null
  try {
    const businessDetails = await db.business.upsert({
      where: {
        id: business.id,
      },
      update: business,
      create: {
        users: {
          connect: { email: business.companyEmail },
        },
        ...business,
        SidebarOption: {
          create: [
            {
              name: 'Calendar',
              icon: 'calendar',
              link: `/business/${business.id}/calendar`,
            },
            {
              name: 'Dashboard',
              icon: 'category',
              link: `/business/${business.id}`,
            },
            //cleanup
            // {
            //   name: 'File Manager',
            //   icon: 'database',
            //   link: `/business/${business.id}/files`,
            // },
            {
              name: 'KickStart',
              icon: 'clipboardIcon',
              link: `/business/${business.id}/kickstart`,
            },
            {
              name: 'Billing',
              icon: 'payment',
              link: `${process.env.NEXT_PUBLIC_PORTAL_URL || 'https://portal.orbit.example'}/billing`,
            },
            {
              name: 'Settings',
              icon: 'settings',
              link: `/business/${business.id}/settings`,
            },
            {
              name: 'Sub Accounts',
              icon: 'person',
              link: `/business/${business.id}/all-subaccounts`,
            },
            {
              name: 'Team',
              icon: 'shield',
              link: `/business/${business.id}/team`,
            },
          ],
        },
      },
    })
    return businessDetails
  } catch (error) {
    console.log(error)
  }
}

/**
 * Mint a new sub-account in Portal and return its canonical Portal cuid.
 *
 * Portal owns sub-account IDENTITY across the ecosystem (WorkPipe, Drive, Conductor
 * all key off the same id). Native WorkPipe creates therefore route through
 * Portal for the id instead of inventing a local v4() that Portal/Drive never
 * see. Forwards the logged-in user's Portal JWT as a Bearer. Throws on failure
 * so a create can't silently fall back to a divergent local id.
 */
export const mintPortalSubAccountId = async (name: string): Promise<string> => {
  const cookieStore = await cookies()
  const token = cookieStore.get(PORTAL_TOKEN_COOKIE)?.value
  if (!token) throw new Error('Not authenticated with Portal')

  const portalUrl =
    process.env.NEXT_PUBLIC_PORTAL_URL || 'https://portal.orbit.example'
  const res = await fetch(`${portalUrl}/api/subaccounts`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ name }),
    cache: 'no-store',
  })
  if (!res.ok) {
    const detail = await res.text().catch(() => '')
    throw new Error(
      `Portal sub-account create failed (${res.status})${detail ? `: ${detail}` : ''}`
    )
  }
  const data = await res.json().catch(() => null)
  const id = data?.subAccount?.id
  if (!id) throw new Error('Portal returned no sub-account id')
  return id as string
}

export const upsertSubAccount = async (subAccount: SubAccount) => {
  if (!subAccount.companyEmail) {
    console.error(
      '[upsertSubAccount] missing companyEmail for subaccount',
      subAccount.id
    )
    return null
  }
  const businessOwner = await db.user.findFirst({
    where: {
      Business: {
        id: subAccount.businessId,
      },
      role: 'BUSINESS_OWNER',
    },
  })
  if (!businessOwner) {
    console.error(
      '[upsertSubAccount] no BUSINESS_OWNER for business',
      subAccount.businessId
    )
    return null
  }
  const permissionId = v4()
  const response = await db.subAccount.upsert({
    where: { id: subAccount.id },
    update: subAccount,
    create: {
      ...subAccount,
      Permissions: {
        create: {
          access: true,
          email: businessOwner.email,
          id: permissionId,
        },
        connect: {
          subAccountId: subAccount.id,
          id: permissionId,
        },
      },
      Pipeline: {
        create: { name: 'Sub Account Onboarding' },
      },
      SidebarOption: {
        create: [
          {
            name: 'Kick Start',
            icon: 'clipboardIcon',
            link: `/subaccount/${subAccount.id}/kickstart`,
          },
          {
            name: 'Settings',
            icon: 'settings',
            link: `/subaccount/${subAccount.id}/settings`,
          },
          {
            name: 'Funnels',
            icon: 'pipelines',
            link: `/subaccount/${subAccount.id}/funnels`,
          },
          {
            name: 'Media',
            icon: 'database',
            link: `/subaccount/${subAccount.id}/media`,
          },
          //cleanup
          // {
          //   name: 'File Manager',
          //   icon: 'database',
          //   link: `/subaccount/${subAccount.id}/files`,
          // },
          {
            name: 'Automations',
            icon: 'chip',
            link: `/subaccount/${subAccount.id}/automations`,
          },
          {
            name: 'Pipelines',
            icon: 'flag',
            link: `/subaccount/${subAccount.id}/pipelines`,
          },
          {
            name: 'Contacts',
            icon: 'person',
            link: `/subaccount/${subAccount.id}/contacts`,
          },
          {
            name: 'Calendar',
            icon: 'calendar',
            link: `/subaccount/${subAccount.id}/calendar`,
          },
          {
            name: 'Services',
            icon: 'clipboardIcon',
            link: `/subaccount/${subAccount.id}/services`,
          },
          {
            name: 'Invoices',
            icon: 'receipt',
            link: `/subaccount/${subAccount.id}/invoices`,
          },
          {
            name: 'Documents',
            icon: 'database',
            link: `/subaccount/${subAccount.id}/documents`,
          },
          {
            name: 'Dashboard',
            icon: 'category',
            link: `/subaccount/${subAccount.id}`,
          },
        ],
      },
    },
  })
  return response
}

export const getSubaccountDetails = async (subaccountId: string) => {
  const response = await db.subAccount.findUnique({
    where: {
      id: subaccountId,
    },
  })
  return response
}

export const deleteSubAccount = async (subaccountId: string) => {
  await assertOwnsSubAccount(subaccountId)
  const response = await db.subAccount.delete({
    where: {
      id: subaccountId,
    },
  })
  return response
}

export const getSubAccountTeamMembers = async (subaccountId: string) => {
  await assertOwnsSubAccount(subaccountId)
  const subaccountUsersWithAccess = await db.user.findMany({
    where: {
      Business: {
        SubAccount: {
          some: {
            id: subaccountId,
          },
        },
      },
      role: 'SUBACCOUNT_USER',
      Permissions: {
        some: {
          subAccountId: subaccountId,
          access: true,
        },
      },
    },
  })
  return subaccountUsersWithAccess
}

export const getUserPermissions = async (userId: string) => {
  const response = await db.user.findUnique({
    where: { id: userId },
    select: { Permissions: { include: { SubAccount: true } } },
  })

  return response
}

export const getUser = async (id: string) => {
  const user = await db.user.findUnique({
    where: {
      id,
    },
  })

  return user
}

export const deleteUser = async (userId: string) => {
  const client = await getAuthAdmin()
  await client.users.updateUserMetadata(userId, {
    privateMetadata: {
      role: undefined,
    },
  })
  const deletedUser = await db.user.delete({ where: { id: userId } })

  return deletedUser
}

export const updateUser = async (user: Partial<User>) => {
  if (!user.email) {
    console.error('[updateUser] missing email in payload — skipping', user)
    return null
  }

  // Only touch the columns this form owns — never spread id/timestamps/FKs.
  // Guards against the empty-payload 500 (`update({ where:{email:undefined},
  // data:{} })`) seen when the settings form submitted a blank object.
  const data: Prisma.UserUpdateInput = {}
  if (user.name !== undefined) data.name = user.name
  if (user.avatarUrl !== undefined) data.avatarUrl = user.avatarUrl
  if (user.role !== undefined) data.role = user.role
  if (Object.keys(data).length === 0) {
    console.error('[updateUser] no updatable fields for', user.email)
    return null
  }

  const response = await db.user.update({
    where: { email: user.email },
    data,
  })

  const client = await getAuthAdmin()
  await client.users.updateUserMetadata(response.id, {
    privateMetadata: {
      role: user.role || 'SUBACCOUNT_USER',
    },
  })

  return response
}

export const changeUserPermissions = async (
  permissionId: string | undefined,
  userEmail: string,
  subAccountId: string,
  permission: boolean
) => {
  try {
    const response = await db.permissions.upsert({
      where: { id: permissionId },
      update: { access: permission },
      create: {
        access: permission,
        email: userEmail,
        subAccountId: subAccountId,
      },
    })
    return response
  } catch (error) {
    console.log('🔴Could not change persmission', error)
  }
}

export const _getTicketsWithAllRelations = async (laneId: string) => {
  const response = await db.ticket.findMany({
    where: { laneId: laneId },
    include: {
      Assigned: true,
      Customer: true,
      Lane: true,
      Tags: true,
    },
  })
  return response
}

export const getFunnels = async (subacountId: string) => {
  await assertOwnsSubAccount(subacountId)
  const funnels = await db.funnel.findMany({
    where: { subAccountId: subacountId },
    include: { FunnelPages: true },
  })

  return funnels
}

export const getFunnel = async (funnelId: string) => {
  const funnel = await db.funnel.findUnique({
    where: { id: funnelId },
    include: {
      FunnelPages: {
        orderBy: {
          order: 'asc',
        },
      },
    },
  })

  return funnel
}

export const getProfiles = async (subacountId: string) => {
  const profiles = await db.profile.findMany({
    where: { subAccountId: subacountId },
    include: { ProfilePages: true },
  })

  return profiles
}

export const getMedia = async (subaccountId: string) => {
  await assertOwnsSubAccount(subaccountId)
  const mediafiles = await db.subAccount.findUnique({
    where: {
      id: subaccountId,
    },
    include: { Media: true },
  })
  return mediafiles
}

export const createMedia = async (
  subaccountId: string,
  mediaFile: CreateMediaType
) => {
  const response = await db.media.create({
    data: {
      link: mediaFile.link,
      name: mediaFile.name,
      subAccountId: subaccountId,
    },
  })

  return response
}

export const deleteMedia = async (mediaId: string) => {
  await assertOwnsMedia(mediaId)
  const response = await db.media.delete({
    where: {
      id: mediaId,
    },
  })
  return response
}

// ---------------------------------------------------------------------------
// Invoices (#22)
// ---------------------------------------------------------------------------

/**
 * Back-fill the "Invoices" sidebar link for a sub-account. Sidebar options are
 * seeded once at provisioning, so sub-accounts created before the Invoices
 * entry existed never got it. Called from the sub-account layout — idempotent
 * (no-op once present) and non-blocking (a failure never breaks the page).
 */
export const ensureInvoicesSidebarOption = async (subaccountId: string) => {
  try {
    const link = `/subaccount/${subaccountId}/invoices`
    const existing = await db.subAccountSidebarOption.findFirst({
      where: { subAccountId: subaccountId, link },
      select: { id: true },
    })
    if (existing) return
    await db.subAccountSidebarOption.create({
      data: {
        name: 'Invoices',
        icon: 'receipt',
        link,
        subAccountId: subaccountId,
      },
    })
  } catch (error) {
    console.error('[ensureInvoicesSidebarOption] failed (non-blocking):', error)
  }
}

export const getInvoices = async (subaccountId: string) => {
  await assertOwnsSubAccount(subaccountId)
  return db.invoice.findMany({
    where: { subAccountId: subaccountId },
    include: { services: true },
    orderBy: { createdAt: 'desc' },
  })
}

export const getInvoice = async (invoiceId: string) => {
  await assertOwnsInvoice(invoiceId)
  return db.invoice.findUnique({
    where: { id: invoiceId },
    include: { services: true },
  })
}

/**
 * Create or update an invoice and its line items.
 *
 * Input is validated with Zod; all amounts (line totals, subtotal, total due)
 * are recomputed server-side from quantity × unit price + tax − discount, so a
 * client can never dictate what is owed. `status`/`paidAt`/`number` are managed
 * elsewhere (draft on create; PAID via the Stripe webhook) and are never
 * overwritten here. Line items are replaced wholesale inside a transaction.
 */
export const upsertInvoice = async (
  subaccountId: string,
  data: z.infer<typeof InvoiceFormSchema>,
  invoiceId?: string
) => {
  await assertOwnsSubAccount(subaccountId)
  const parsed = InvoiceFormSchema.parse(data)
  const { lines, subTotalCents, totalDueCents } = computeInvoiceTotals(
    parsed.services,
    parsed.taxCents,
    parsed.discountCents
  )

  const id = invoiceId || v4()
  const invoiceData = {
    name: parsed.name,
    type: parsed.type ?? null,
    dueDate: parsed.dueDate ?? null,
    currency: parsed.currency,
    netPaymentTerm: parsed.netPaymentTerm ?? null,
    taxCents: parsed.taxCents,
    discountCents: parsed.discountCents,
    subTotalCents,
    totalDueCents,
  }

  const invoice = await db.$transaction(async tx => {
    const upserted = await tx.invoice.upsert({
      where: { id },
      update: invoiceData,
      create: { ...invoiceData, id, subAccountId: subaccountId },
    })
    // The form edits the full line-item set — replace, don't diff.
    await tx.invoiceService.deleteMany({ where: { invoiceId: id } })
    if (lines.length) {
      await tx.invoiceService.createMany({
        data: lines.map(l => ({
          invoiceId: id,
          name: l.name,
          description: l.description ?? null,
          type: l.type ?? null,
          quantity: l.quantity,
          unitPriceCents: l.unitPriceCents,
          totalCents: l.totalCents,
        })),
      })
    }
    return upserted
  })

  await saveActivityLogsNotification({
    subaccountId,
    description: `Updated invoice | ${invoice.name}`,
  })

  return invoice
}

export const deleteInvoice = async (
  subaccountId: string,
  invoiceId: string
) => {
  await assertOwnsSubAccount(subaccountId)
  // Scope by sub-account so a caller can only delete their own invoices.
  const result = await db.invoice.deleteMany({
    where: { id: invoiceId, subAccountId: subaccountId },
  })
  if (result.count > 0) {
    await saveActivityLogsNotification({
      subaccountId,
      description: `Deleted an invoice`,
    })
  }
  return result
}

// Public, token-authorized lookup for the customer-facing pay/view page.
// The `link` token is an unguessable UUID — possession of it IS the authorization.
export const getInvoiceByLink = async (link: string) => {
  return db.invoice.findUnique({
    where: { link },
    include: { services: true, Subaccount: true },
  })
}

/**
 * Ensure an invoice has a public pay link and mark it SENT. Idempotent: the
 * token is generated once and reused; re-sharing a PAID/SENT invoice keeps its
 * status. Scoped by sub-account. Returns the token so the caller can build the
 * shareable URL.
 */
export const markInvoiceSent = async (
  subaccountId: string,
  invoiceId: string
) => {
  const existing = await db.invoice.findFirst({
    where: { id: invoiceId, subAccountId: subaccountId },
    select: { id: true, link: true, status: true },
  })
  if (!existing) throw new Error('NOT_FOUND')

  const link = existing.link || v4()
  const updated = await db.invoice.update({
    where: { id: existing.id },
    data: {
      link,
      status: existing.status === 'DRAFT' ? 'SENT' : existing.status,
    },
    select: { link: true, status: true },
  })

  await saveActivityLogsNotification({
    subaccountId,
    description: `Shared an invoice link`,
  })

  return updated
}

// Flat {id,name,email} contact list for the "send invoice to a contact" picker.
export const getContactOptions = async (subaccountId: string) => {
  await assertOwnsSubAccount(subaccountId)
  return db.contact.findMany({
    where: { subAccountId: subaccountId },
    select: { id: true, name: true, email: true },
    orderBy: { name: 'asc' },
  })
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

/**
 * Email an invoice to a customer over SMTP. Ensures the pay link + SENT status
 * (reuses markInvoiceSent), renders a branded email with a View & Pay button
 * pointing at the public invoice page, and sends it. Scoped by sub-account.
 */
export const sendInvoiceEmail = async (
  subaccountId: string,
  invoiceId: string,
  recipientEmail: string
) => {
  const to = recipientEmail.trim()
  if (!EMAIL_RE.test(to)) throw new Error('INVALID_EMAIL')

  const invoice = await db.invoice.findFirst({
    where: { id: invoiceId, subAccountId: subaccountId },
    include: { Subaccount: true },
  })
  if (!invoice) throw new Error('NOT_FOUND')

  // Ensure the public pay link exists and mark the invoice SENT.
  const { link } = await markInvoiceSent(subaccountId, invoiceId)

  const base = (process.env.NEXT_PUBLIC_URL || '').replace(/\/$/, '')
  const payUrl = `${base}/invoice/${link}`
  const businessName = invoice.Subaccount?.name || 'Invoice'
  const currency = (invoice.currency || 'usd').toUpperCase()
  const amount = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
  }).format(invoice.totalDueCents / 100)
  const dueStr = invoice.dueDate
    ? new Date(invoice.dueDate).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      })
    : null

  const html = `
  <div style="font-family: -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif; max-width: 600px; margin: 0 auto; color: #111;">
    <h2 style="margin: 0 0 4px;">${businessName}</h2>
    <p style="color: #555; margin: 0 0 20px;">You have a new invoice${invoice.number ? ` #${invoice.number}` : ''}.</p>
    <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px;">
      <tr><td style="padding: 6px 0; color: #555;">Invoice</td><td style="padding: 6px 0; text-align: right; font-weight: 600;">${invoice.name}</td></tr>
      <tr><td style="padding: 6px 0; color: #555;">Amount due</td><td style="padding: 6px 0; text-align: right; font-weight: 600;">${amount}</td></tr>
      ${dueStr ? `<tr><td style="padding: 6px 0; color: #555;">Due</td><td style="padding: 6px 0; text-align: right;">${dueStr}</td></tr>` : ''}
    </table>
    <a href="${payUrl}" style="display: inline-block; background: #2B2FFF; color: #fff; padding: 12px 22px; border-radius: 8px; text-decoration: none; font-weight: 600;">View &amp; Pay Invoice</a>
    <p style="color: #888; font-size: 12px; margin-top: 20px;">Or open this link: <a href="${payUrl}" style="color: #2B2FFF;">${payUrl}</a></p>
  </div>`

  await sendMail({
    to,
    subject: `Invoice from ${businessName} — ${amount} due`,
    html,
    fromName: businessName,
  })

  await saveActivityLogsNotification({
    subaccountId,
    description: `Emailed an invoice to ${to}`,
  })

  return { ok: true }
}

export const getPipelineDetails = async (pipelineId: string) => {
  await assertOwnsPipeline(pipelineId)
  const response = await db.pipeline.findUnique({
    where: {
      id: pipelineId,
    },
  })
  return response
}

export const deletePipeline = async (pipelineId: string) => {
  await assertOwnsPipeline(pipelineId)
  const response = await db.pipeline.delete({
    where: { id: pipelineId },
  })
  return response
}

export const getTicketsWithTags = async (pipelineId: string) => {
  await assertOwnsPipeline(pipelineId)
  const response = await db.ticket.findMany({
    where: {
      Lane: {
        pipelineId,
      },
    },
    include: { Tags: true, Assigned: true, Customer: true },
  })
  // Convert Decimal to number for client component serialization
  return response.map(ticket => ({
    ...ticket,
    value: ticket.value?.toNumber() ?? null,
  }))
}

export const getTagsForSubaccount = async (subaccountId: string) => {
  await assertOwnsSubAccount(subaccountId)
  const response = await db.subAccount.findUnique({
    where: { id: subaccountId },
    select: { Tags: true },
  })
  return response
}

export const upsertTag = async (
  subaccountId: string,
  tag: Prisma.TagUncheckedCreateInput
) => {
  await assertOwnsSubAccount(subaccountId)
  const response = await db.tag.upsert({
    where: { id: tag.id || v4(), subAccountId: subaccountId },
    update: tag,
    create: { ...tag, subAccountId: subaccountId },
  })

  return response
}

export const deleteTag = async (tagId: string) => {
  await assertOwnsTag(tagId)
  const response = await db.tag.delete({ where: { id: tagId } })
  return response
}

export const sendInvitation = async (
  role: Role,
  email: string,
  businessId: string
) => {
  // First, check if there's an existing invitation in our database
  const existingInvitation = await db.invitation.findUnique({
    where: { email },
  })

  if (existingInvitation) {
    // Delete the existing invitation from our database
    await db.invitation.delete({
      where: { email },
    })
  }

  // Check for and revoke any existing invitations in Clerk
  try {
    const client = await getAuthAdmin()
    const invitations = await client.invitations.getInvitationList()
    console.log('invitation list: ', invitations)
    const clerkInvitation = invitations.data.find(
      (invitation: any) => invitation.emailAddress === email
    )
    console.log('invitation match: ', clerkInvitation?.emailAddress)
    if (
      clerkInvitation &&
      (clerkInvitation.status === 'accepted' ||
        clerkInvitation.status === 'pending' ||
        clerkInvitation.status === 'revoked')
    ) {
      // Revoke the existing invitation in Clerk
      await client.invitations.revokeInvitation(clerkInvitation.id)
    }
  } catch (error) {
    console.log('Error handling Clerk invitation:', error)
    // Continue even if there's an error with Clerk
  }

  // Create a new invitation in our database
  const response = await db.invitation.create({
    data: { email, businessId, role },
  })

  // Create a new invitation in Clerk
  try {
    const client = await getAuthAdmin()
    await client.invitations.createInvitation({
      emailAddress: email,
      redirectUrl: process.env.NEXT_PUBLIC_URL,
      publicMetadata: {
        throughInvitation: true,
        role,
      },
    })
  } catch (error) {
    console.log('Error creating Clerk invitation:', error)
    // If Clerk invitation fails, delete the one we just created in our database
    await db.invitation.delete({
      where: { email },
    })
    throw error
  }

  return response
}

export const getPipelines = async (subaccountId: string) => {
  await assertOwnsSubAccount(subaccountId)
  const response = await db.pipeline.findMany({
    where: { subAccountId: subaccountId },
    include: {
      Lane: {
        include: { Tickets: true },
      },
    },
  })
  // Convert Decimal values to numbers for client component serialization
  return response.map(pipeline => ({
    ...pipeline,
    Lane: pipeline.Lane.map(lane => ({
      ...lane,
      Tickets: lane.Tickets.map(ticket => ({
        ...ticket,
        value: ticket.value?.toNumber() ?? null,
      })),
    })),
  }))
}

export const upsertLane = async (lane: Prisma.LaneUncheckedCreateInput) => {
  await assertOwnsPipeline(lane.pipelineId)
  let order: number

  if (!lane.order) {
    const lanes = await db.lane.findMany({
      where: {
        pipelineId: lane.pipelineId,
      },
    })

    order = lanes.length
  } else {
    order = lane.order
  }

  const response = await db.lane.upsert({
    where: { id: lane.id || v4() },
    update: lane,
    create: { ...lane, order },
  })

  return response
}

export const getDomainContent = async (subDomainName: string) => {
  // Only resolve PUBLISHED funnels on the public live site. subDomainName is
  // unique, but findFirst lets us also require published — a draft funnel that
  // happens to have a subdomain must not be publicly reachable.
  const response = await db.funnel.findFirst({
    where: {
      subDomainName,
      published: true,
    },
    include: { FunnelPages: true },
  })
  return response
}

export const getLanesWithTicketAndTags = async (pipelineId: string) => {
  await assertOwnsPipeline(pipelineId)
  const response = await db.lane.findMany({
    where: {
      pipelineId,
    },
    orderBy: { order: 'asc' },
    include: {
      Tickets: {
        orderBy: {
          order: 'asc',
        },
        include: {
          Tags: true,
          Assigned: true,
          Customer: true,
        },
      },
    },
  })
  return response
}

export const updateLanesOrder = async (lanes: Lane[]) => {
  await Promise.all(lanes.map(lane => assertOwnsLane(lane.id)))
  try {
    const updateTrans = lanes.map(lane =>
      db.lane.update({
        where: {
          id: lane.id,
        },
        data: {
          order: lane.order,
        },
      })
    )

    await db.$transaction(updateTrans)
    console.log('🟢 Done reordered 🟢')
  } catch (error) {
    console.log(error, 'ERROR UPDATE LANES ORDER')
  }
}

export const deleteLane = async (laneId: string) => {
  await assertOwnsLane(laneId)
  const resposne = await db.lane.delete({ where: { id: laneId } })
  return resposne
}

export const upsertPipeline = async (
  pipeline: Prisma.PipelineUncheckedCreateWithoutLaneInput
) => {
  await assertOwnsSubAccount(pipeline.subAccountId)
  const response = await db.pipeline.upsert({
    where: { id: pipeline.id || v4() },
    update: pipeline,
    create: pipeline,
  })

  return response
}

export const upsertFunnel = async (
  subaccountId: string,
  funnel: z.infer<typeof CreateFunnelFormSchema> & { liveProducts: string },
  funnelId: string
) => {
  await assertOwnsSubAccount(subaccountId)
  try {
    // Convert empty subDomainName to null to avoid unique constraint issues
    const processedFunnel = {
      ...funnel,
      subDomainName: funnel.subDomainName?.trim() || null,
    }

    const response = await db.funnel.upsert({
      where: { id: funnelId },
      update: processedFunnel,
      create: {
        ...processedFunnel,
        id: funnelId || v4(),
        subAccountId: subaccountId,
      },
    })

    return response
  } catch (error) {
    console.error('Error upserting funnel:', error)
    throw error
  }
}

export const deleteFunnelePage = async (funnelPageId: string) => {
  await assertOwnsFunnelPage(funnelPageId)
  try {
    // First check if the funnel page exists
    const existingPage = await db.funnelPage.findUnique({
      where: { id: funnelPageId },
    })

    if (!existingPage) {
      throw new Error(`Funnel page with ID ${funnelPageId} not found`)
    }

    const response = await db.funnelPage.delete({
      where: { id: funnelPageId },
    })

    return response
  } catch (error) {
    console.error('Error deleting funnel page:', error)
    throw error
  }
}

export const getFunnelPageDetails = async (funnelPageId: string) => {
  const response = await db.funnelPage.findUnique({
    where: {
      id: funnelPageId,
    },
  })

  return response
}

export const upsertFunnelPage = async (
  subaccountId: string,
  funnelPage: UpsertFunnelPage,
  funnelId: string
) => {
  if (!subaccountId || !funnelId) {
    console.error('[upsertFunnelPage] Missing subaccountId or funnelId')
    return null
  }

  await assertOwnsSubAccount(subaccountId)

  try {
    // Log incoming data for debugging
    console.log(
      '[upsertFunnelPage] Received:',
      JSON.stringify(funnelPage, null, 2)
    )

    // Extract fields explicitly
    const pageId = (funnelPage as UpsertFunnelPage & { id?: string }).id || ''
    const name = funnelPage.name
    const pathName = funnelPage.pathName ?? ''
    const order = funnelPage.order ?? 0
    const content = funnelPage.content
    const previewImage = funnelPage.previewImage

    console.log(
      '[upsertFunnelPage] Extracted - name:',
      name,
      'pathName:',
      pathName,
      'order:',
      order
    )

    // Validate required fields
    if (!name) {
      throw new Error('Funnel page name is required')
    }

    const response = await db.funnelPage.upsert({
      where: { id: pageId },
      update: {
        name,
        pathName,
        order,
        ...(content && { content }),
        ...(previewImage && { previewImage }),
      },
      create: {
        name,
        pathName,
        order,
        content:
          content ||
          JSON.stringify([
            {
              content: [],
              id: '__body',
              name: 'Body',
              styles: { backgroundColor: 'white' },
              type: '__body',
            },
          ]),
        funnelId,
      },
    })

    revalidatePath(`/subaccount/${subaccountId}/funnels/${funnelId}`, 'page')
    return response
  } catch (error) {
    console.error('[upsertFunnelPage] Error:', error)
    throw error
  }
}

export const updateFunnelProducts = async (
  products: string,
  funnelId: string
) => {
  const data = await db.funnel.update({
    where: { id: funnelId },
    data: { liveProducts: products },
  })
  return data
}

export const upsertContact = async (
  contact: Prisma.ContactUncheckedCreateInput
) => {
  await assertOwnsSubAccount(contact.subAccountId)
  const response = await db.contact.upsert({
    where: { id: contact.id || v4() },
    update: contact,
    create: contact,
  })
  return response
}

export const searchContacts = async (
  subAccountId: string,
  searchTerms = ''
) => {
  try {
    const response = await db.contact.findMany({
      where: {
        subAccountId,
        name: {
          contains: searchTerms,
        },
      },
    })
    return response
  } catch (error) {
    console.error('Error searching contacts:', error)
    return []
  }
}

export const getSubAccountContacts = async (subaccountId: string) => {
  await assertOwnsSubAccount(subaccountId)
  const response = await db.subAccount.findMany({
    where: { id: subaccountId },
    select: { Contact: true },
  })

  return response
}

export const upsertTicket = async (
  ticket: Prisma.TicketUncheckedCreateInput,
  tags: Tag[]
) => {
  await assertOwnsLane(ticket.laneId)
  let order: number
  if (!ticket.order) {
    const tickets = await db.ticket.findMany({
      where: { laneId: ticket.laneId },
    })
    order = tickets.length
  } else {
    order = ticket.order
  }

  const response = await db.ticket.upsert({
    where: {
      id: ticket.id || v4(),
    },
    update: { ...ticket, Tags: { set: tags } },
    create: { ...ticket, Tags: { connect: tags }, order },
    include: {
      Assigned: true,
      Customer: true,
      Tags: true,
      Lane: true,
    },
  })

  // Convert Decimal to number for client component serialization
  return {
    ...response,
    value: response.value?.toNumber() ?? null,
  }
}

export const deleteTicket = async (ticketId: string) => {
  await assertOwnsTicket(ticketId)
  await db.ticket.delete({
    where: {
      id: ticketId,
    },
  })
}

export const updateTicketsOrder = async (tickets: Ticket[]) => {
  await Promise.all(tickets.map(ticket => assertOwnsTicket(ticket.id)))
  try {
    const updateTrans = tickets.map(ticket =>
      db.ticket.update({
        where: {
          id: ticket.id,
        },
        data: {
          order: ticket.order,
          laneId: ticket.laneId,
        },
      })
    )

    await db.$transaction(updateTrans)
    console.log('🟢 Done reordered 🟢')
  } catch (error) {
    console.log(error, '🔴 ERROR UPDATE TICKET ORDER')
  }
}
