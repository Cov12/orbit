'use server'

import { clerkClient, currentUser } from '@clerk/nextjs/server'
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
import { redirect } from 'next/navigation'
import { v4 } from 'uuid'
import { z } from 'zod'

import { db } from './db'
import {
  CreateFunnelFormSchema,
  CreateMediaType,
  UpsertFunnelPage,
} from './types'

export const getAuthUserDetails = async () => {
  const user = await currentUser()
  if (!user) {
    return
  }

  const userData = await db.user.findUnique({
    where: {
      email: user.emailAddresses[0].emailAddress,
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
  const user = await currentUser()
  if (!user) return

  const userData = await db.user.upsert({
    where: {
      email: user.emailAddresses[0].emailAddress,
    },
    update: newUser,
    create: {
      id: user.id,
      avatarUrl: user.imageUrl,
      email: user.emailAddresses[0].emailAddress,
      name: `${user.firstName} ${user.lastName}`,
      role: newUser.role || 'SUBACCOUNT_USER',
    },
  })

  await clerkClient.users.updateUserMetadata(user.id, {
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
  const user = await currentUser()
  if (!user) return redirect('/sign-in')
  const invitationExists = await db.invitation.findUnique({
    where: {
      email: user.emailAddresses[0].emailAddress,
      status: 'PENDING',
    },
  })

  if (invitationExists) {
    const userDetails = await createTeamUser(invitationExists.businessId, {
      email: invitationExists.email,
      businessId: invitationExists.businessId,
      avatarUrl: user.imageUrl,
      id: user.id,
      name: `${user.firstName} ${user.lastName}`,
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
      await clerkClient.users.updateUserMetadata(user.id, {
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
        email: user.emailAddresses[0].emailAddress,
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
  const authUser = await currentUser()
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
      where: { email: authUser?.emailAddresses[0].emailAddress },
    })
  }

  // Cleanup
  // TO DO: add error handling
  if (!userData) {
    console.log('Could not find a user')
    return
  }

  let foundBusinessId = businessId
  if (!foundBusinessId) {
    if (!subaccountId) {
      throw new Error(
        'You need to provide atleast an business Id or subaccount Id'
      )
    }
    const response = await db.subAccount.findUnique({
      where: { id: subaccountId },
    })
    if (response) foundBusinessId = response.businessId
  }
  if (subaccountId) {
    await db.notification.create({
      data: {
        notification: `${userData.name} | ${description ?? 'Updated information'}`,
        User: {
          connect: {
            id: userData.id,
          },
        },
        Business: {
          connect: {
            id: foundBusinessId,
          },
        },
        SubAccount: {
          connect: { id: subaccountId },
        },
      },
    })
  } else {
    await db.notification.create({
      data: {
        notification: `${userData.name} | ${description}`,
        User: {
          connect: {
            id: userData.id,
          },
        },
        Business: {
          connect: {
            id: foundBusinessId,
          },
        },
      },
    })
  }
}

export const getNotificationAndUser = async (businessId: string) => {
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
  const response = await db.business.update({
    where: { id: businessId },
    data: { ...businessDetails },
  })
  return response
}

export const deleteBusiness = async (businessId: string) => {
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
              link: `/business/${business.id}/billing`,
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

export const upsertSubAccount = async (subAccount: SubAccount) => {
  if (!subAccount.companyEmail) return null
  const businessOwner = await db.user.findFirst({
    where: {
      Business: {
        id: subAccount.businessId,
      },
      role: 'BUSINESS_OWNER',
    },
  })
  if (!businessOwner) return console.log('🔴Erorr could not create subaccount')
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
  const response = await db.subAccount.delete({
    where: {
      id: subaccountId,
    },
  })
  return response
}

export const getSubAccountTeamMembers = async (subaccountId: string) => {
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
  await clerkClient.users.updateUserMetadata(userId, {
    privateMetadata: {
      role: undefined,
    },
  })
  const deletedUser = await db.user.delete({ where: { id: userId } })

  return deletedUser
}

export const updateUser = async (user: Partial<User>) => {
  const response = await db.user.update({
    where: { email: user.email },
    data: { ...user },
  })

  await clerkClient.users.updateUserMetadata(response.id, {
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
  const response = await db.media.delete({
    where: {
      id: mediaId,
    },
  })
  return response
}

export const getPipelineDetails = async (pipelineId: string) => {
  const response = await db.pipeline.findUnique({
    where: {
      id: pipelineId,
    },
  })
  return response
}

export const deletePipeline = async (pipelineId: string) => {
  const response = await db.pipeline.delete({
    where: { id: pipelineId },
  })
  return response
}

export const getTicketsWithTags = async (pipelineId: string) => {
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
  const response = await db.tag.upsert({
    where: { id: tag.id || v4(), subAccountId: subaccountId },
    update: tag,
    create: { ...tag, subAccountId: subaccountId },
  })

  return response
}

export const deleteTag = async (tagId: string) => {
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
    const invitations = await clerkClient.invitations.getInvitationList()
    console.log('invitation list: ', invitations)
    const clerkInvitation = invitations.find(
      invitation => invitation.emailAddress === email
    )
    console.log('invitation match: ', clerkInvitation?.emailAddress)
    if (
      clerkInvitation &&
      (clerkInvitation.status === 'accepted' ||
        clerkInvitation.status === 'pending' ||
        clerkInvitation.status === 'revoked')
    ) {
      // Revoke the existing invitation in Clerk
      await clerkClient.invitations.revokeInvitation(clerkInvitation.id)
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
    await clerkClient.invitations.createInvitation({
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
  const response = await db.funnel.findUnique({
    where: {
      subDomainName,
    },
    include: { FunnelPages: true },
  })
  return response
}

export const getLanesWithTicketAndTags = async (pipelineId: string) => {
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
  const resposne = await db.lane.delete({ where: { id: laneId } })
  return resposne
}

export const upsertPipeline = async (
  pipeline: Prisma.PipelineUncheckedCreateWithoutLaneInput
) => {
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
  const response = await db.funnel.upsert({
    where: { id: funnelId },
    update: funnel,
    create: {
      ...funnel,
      id: funnelId || v4(),
      subAccountId: subaccountId,
    },
  })

  return response
}

export const deleteFunnelePage = async (funnelPageId: string) => {
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
  if (!subaccountId || !funnelId) return
  const response = await db.funnelPage.upsert({
    where: { id: funnelPage.id || '' },
    update: { ...funnelPage },
    create: {
      ...funnelPage,
      content: funnelPage.content
        ? funnelPage.content
        : JSON.stringify([
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
  const response = await db.contact.upsert({
    where: { id: contact.id || v4() },
    update: contact,
    create: contact,
  })
  return response
}

export const searchContacts = async (searchTerms: string) => {
  try {
    const response = await db.contact.findMany({
      where: {
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
  await db.ticket.delete({
    where: {
      id: ticketId,
    },
  })
}

export const updateTicketsOrder = async (tickets: Ticket[]) => {
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
