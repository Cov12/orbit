import {
  Contact,
  Lane,
  Notification,
  Prisma,
  Role,
  Tag,
  Ticket,
  User,
} from '@prisma/client'
import Stripe from 'stripe'
import { z } from 'zod'

import { db } from './db'
import {
  _getTicketsWithAllRelations,
  getAuthUserDetails,
  getFunnels,
  getMedia,
  getPipelineDetails,
  getProfiles,
  getTicketsWithTags,
  getUserPermissions,
} from './queries'

export type NotificationWithUser =
  | ({
      User: {
        id: string
        name: string
        avatarUrl: string
        email: string
        createdAt: Date
        updatedAt: Date
        role: Role
        businessId: string | null
      }
    } & Notification)[]
  | undefined

export type UserWithPermissionsAndSubAccounts = Prisma.PromiseReturnType<
  typeof getUserPermissions
>

export const FunnelPageSchema = z.object({
  name: z.string().min(1),
  pathName: z.string().optional(),
})

export const ProfilePageSchema = z.object({
  name: z.string().min(1),
  pathName: z.string().optional(),
})

const __getUsersWithBusinessSubAccountPermissionsSidebarOptions = async (
  businessId: string
) => {
  return await db.user.findFirst({
    where: { Business: { id: businessId } },
    include: {
      Business: { include: { SubAccount: true } },
      Permissions: { include: { SubAccount: true } },
    },
  })
}

export type AuthUserWithBusinessSigebarOptionsSubAccounts =
  Prisma.PromiseReturnType<typeof getAuthUserDetails>

export type UsersWithBusinessSubAccountPermissionsSidebarOptions =
  Prisma.PromiseReturnType<
    typeof __getUsersWithBusinessSubAccountPermissionsSidebarOptions
  >

export type GetMediaFiles = Prisma.PromiseReturnType<typeof getMedia>

export type CreateMediaType = Prisma.MediaCreateWithoutSubaccountInput

export type TicketAndTags = Ticket & {
  Tags: Tag[]
  Assigned: User | null
  Customer: Contact | null
}

export type LaneDetail = Lane & {
  Tickets: TicketAndTags[]
}

// Serialized versions with Decimal converted to number for client components
export type SerializedTicket = Omit<TicketAndTags, 'value'> & {
  value: number | null
}

export type SerializedLane = Omit<LaneDetail, 'Tickets'> & {
  Tickets: SerializedTicket[]
}

export const CreatePipelineFormSchema = z.object({
  name: z.string().min(1),
})

export const CreateFunnelFormSchema = z.object({
  name: z.string().min(1),
  description: z.string(),
  subDomainName: z.string().optional(),
  favicon: z.string().optional(),
  published: z.boolean().optional(),
})

export const CreateProfileFormSchema = z.object({
  name: z.string().min(1),
  description: z.string(),
  subDomainName: z.string().optional(),
  favicon: z.string().optional(),
})

export type PipelineDetailsWithLanesCardsTagsTickets = Prisma.PromiseReturnType<
  typeof getPipelineDetails
>

export const LaneFormSchema = z.object({
  name: z.string().min(1),
})

export type TicketWithTags = Prisma.PromiseReturnType<typeof getTicketsWithTags>

const currencyNumberRegex = /^\d+(\.\d{1,2})?$/

export const TicketFormSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  value: z.string().refine(value => currencyNumberRegex.test(value), {
    message: 'Value must be a valid price.',
  }),
})

export type TicketDetails = Prisma.PromiseReturnType<
  typeof _getTicketsWithAllRelations
>

export const ContactUserFormSchema = z.object({
  name: z.string().min(1, 'Required'),
  email: z.string().email(),
})

export type Address = {
  city: string
  country: string
  line1: string
  postal_code: string
  state: string
}

export type ShippingInfo = {
  address: Address
  name: string
}

export type StripeCustomerType = {
  email: string
  name: string
  shipping: ShippingInfo
  address: Address
}

export type PricesList = Stripe.ApiList<Stripe.Price>

export type FunnelsForSubAccount = Prisma.PromiseReturnType<
  typeof getFunnels
>[0]

export type ProfilesForSubAccount = Prisma.PromiseReturnType<
  typeof getProfiles
>[0]

export type UpsertFunnelPage = Prisma.FunnelPageCreateWithoutFunnelInput

export type UpsertProfilePage = Prisma.ProfilePageCreateWithoutProfileInput

export const CalendarEventFormSchema = z.object({
  title: z.string().min(1, "Title is required"),
  description: z.string().optional(),
  start: z.string().min(1, "Start date is required"),
  end: z.string().optional(),
  allDay: z.boolean().default(false),
  color: z.string().optional(),
  subAccountId: z.string(),
  contactId: z.string().optional(),
  ticketId: z.string().optional(),
  category: z.string().optional(),
})
