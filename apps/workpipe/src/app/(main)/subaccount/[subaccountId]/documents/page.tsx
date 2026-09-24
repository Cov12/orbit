import { redirect } from 'next/navigation'

type Props = {
  params: Promise<{ subaccountId: string }>
}

// Media + Documents were consolidated into one Files surface (#24). Kept as a
// redirect so existing sidebar entries and bookmarks pointing here still resolve.
const DocumentsPage = async ({ params }: Props) => {
  const { subaccountId } = await params
  redirect(`/subaccount/${subaccountId}/files`)
}

export default DocumentsPage
