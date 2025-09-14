import SendInvitation from '@/components/forms/send-invitation'
import { db } from '@/lib/db'
import { currentUser } from '@clerk/nextjs'
import { Plus } from 'lucide-react'
import { columns } from './columns'
import DataTable from './data-table'

type Props = {
  params: { businessId: string }
}

const TeamPage = async ({ params }: Props) => {
  const authUser = await currentUser()
  const teamMembers = await db.user.findMany({
    where: {
      Business: {
        id: params.businessId,
      },
    },
    include: {
      Business: { include: { SubAccount: true } },
      Permissions: { include: { SubAccount: true } },
    },
  })

  if (!authUser) return null
  const businessDetails = await db.business.findUnique({
    where: {
      id: params.businessId,
    },
    include: {
      SubAccount: true,
    },
  })

  if (!businessDetails) return

  return (
    <DataTable
      actionButtonText={
        <>
          <Plus size={15} />
          Add
        </>
      }
      modalChildren={<SendInvitation businessId={businessDetails.id} />}
      filterValue="name"
      columns={columns}
      data={teamMembers}
    ></DataTable>
  )
}

export default TeamPage
