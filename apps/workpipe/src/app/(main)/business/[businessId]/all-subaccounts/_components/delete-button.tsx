'use client'
import {
    deleteSubAccount,
    getSubaccountDetails,
    saveActivityLogsNotification,
} from '@/lib/queries'
import { useRouter } from 'next/navigation'

type Props = {
  subaccountId: string
}

const DeleteButton = ({ subaccountId }: Props) => {
  const router = useRouter()

  return (
    <div
      className="text-white"
      onClick={async () => {
        const response = await getSubaccountDetails(subaccountId)
        await saveActivityLogsNotification({
          businessId: undefined,
          description: `Deleted a subaccount | ${response?.name}`,
          subaccountId,
        })
        await deleteSubAccount(subaccountId)
        router.refresh()
      }}
    >
      Delete Sub Account
    </div>
  )
}

export default DeleteButton
